import { createHash } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import {
	DEFAULT_CALENDAR_COUNTRY,
	DEFAULT_CALENDAR_TIMEZONE,
	createReleaseReminderIcs,
	normalizeCountryCode,
	normalizeTimezone,
	parseCalendarRange,
	releaseTypeFromTmdb,
	reminderDueDate,
	rollingCalendarWindow,
	sortAndLimitDiscovery,
	type CalendarRange,
	type ReleaseType,
	type ReminderOffset
} from '$lib/release-calendar';
import { db } from '$lib/server/db';
import {
	calendarSyncRuns,
	genres,
	movieGenres,
	moviePersonalScores,
	movieProviderSnapshots,
	movieReleaseEvents,
	movieReleaseReminders,
	movies,
	userMovieInteractions,
	users
} from '$lib/server/db/schema';
import {
	TMDBClient,
	evaluateTMDBIngestionSafety,
	type TMDBMovieSummary,
	type TMDBWatchProvider,
	type TMDBWatchProvidersResponse
} from '$lib/server/tmdb';

const MAX_SYNC_BATCH = 20;
const MAX_SYNC_CANDIDATES = 100;
const PROVIDER_FRESHNESS_MS = 24 * 60 * 60 * 1_000;

type ProviderView = {
	id: number;
	name: string;
	logoPath: string | null;
	monetizationTypes: string[];
	displayPriority: number;
};

export type CalendarSyncResult = {
	runId: string;
	nextCursor: string | null;
	processed: number;
	inserted: number;
	updated: number;
	skipped: number;
	failed: number;
	complete: boolean;
};

export type CalendarItem = {
	eventId: string;
	movieId: string;
	tmdbId: number;
	title: string;
	posterPath: string | null;
	date: string | null;
	releaseType: ReleaseType;
	countryCode: string;
	genres: Array<{ id: number; name: string }>;
	providers: ProviderView[];
	providerLink: string | null;
	providersStale: boolean;
	watchlist: boolean;
	watched: boolean;
	tracked: boolean;
	alanScore: number | null;
	alanScoreStatus: 'unrated' | 'partial' | 'complete';
	reminders: Array<{
		id: string;
		offsetDays: number;
		dueDate: string;
		due: boolean;
	}>;
};

export type CalendarQuery = {
	range: CalendarRange;
	view: 'agenda' | 'month';
	search: string;
	genreId: number | null;
	releaseType: ReleaseType | null;
	countryCode: string;
	watchlist: boolean;
	watched: boolean;
	tracked: boolean;
	alanScore: 'any' | 'unrated' | 'partial' | 'complete';
};

type SyncDependencies = {
	client?: TMDBClient;
	now?: Date;
};

function hash(value: unknown): string {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function safeErrorMessage(error: unknown): string {
	if (!(error instanceof Error)) return 'Unknown synchronization failure.';
	return error.message.replace(/Bearer\s+\S+/giu, 'Bearer [redacted]').slice(0, 300);
}

function validDate(value: string | null | undefined): string | null {
	return value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : null;
}

function normalizeProviders(response: TMDBWatchProvidersResponse) {
	return Object.entries(response.results)
		.filter(([country]) => /^[A-Z]{2}$/u.test(country))
		.map(([countryCode, region]) => {
			const providers = new Map<number, ProviderView>();
			for (const type of ['flatrate', 'free', 'ads', 'rent', 'buy'] as const) {
				for (const provider of region[type] ?? []) {
					const existing = providers.get(provider.provider_id);
					providers.set(provider.provider_id, {
						id: provider.provider_id,
						name: provider.provider_name,
						logoPath: provider.logo_path,
						monetizationTypes: [...new Set([...(existing?.monetizationTypes ?? []), type])].sort(),
						displayPriority: Math.min(
							existing?.displayPriority ?? Number.MAX_SAFE_INTEGER,
							provider.display_priority
						)
					});
				}
			}
			return {
				countryCode,
				link: region.link,
				providers: [...providers.values()].sort(
					(left, right) => left.displayPriority - right.displayPriority || left.id - right.id
				)
			};
		});
}

export async function discoverCalendarCandidates(
	client: TMDBClient,
	now = new Date()
): Promise<{ candidates: TMDBMovieSummary[]; startDate: string; endDate: string }> {
	const { startDate, endDate } = rollingCalendarWindow(now);
	const pages = await Promise.all(
		[1, 2, 3, 4, 5].map((page) => client.discoverUpcomingMovies({ page, startDate, endDate }))
	);
	return {
		candidates: sortAndLimitDiscovery(
			pages.flatMap((page) => page.results),
			MAX_SYNC_CANDIDATES
		),
		startDate,
		endDate
	};
}

async function synchronizeMovie(
	client: TMDBClient,
	tmdbId: number,
	now: Date
): Promise<'inserted' | 'updated' | 'skipped'> {
	const detail = await client.getMovieDetails(tmdbId);
	const safety = evaluateTMDBIngestionSafety(detail);
	if (!safety.allowed) return 'skipped';

	const [releaseDates, watchProviders] = await Promise.all([
		client.getMovieReleaseDates(detail.id),
		client.getMovieWatchProviders(detail.id)
	]);

	return db.transaction(async (transaction) => {
		const existingMovie = await transaction.query.movies.findFirst({
			where: eq(movies.tmdbId, detail.id),
			columns: { id: true, isLocked: true }
		});
		const movieValues = {
			tmdbId: detail.id,
			imdbId: detail.imdb_id,
			title: detail.title,
			originalTitle: detail.original_title,
			originalLanguage: detail.original_language,
			overview: detail.overview,
			tagline: detail.tagline,
			posterPath: detail.poster_path,
			backdropPath: detail.backdrop_path,
			releaseDate: validDate(detail.release_date),
			runtime: detail.runtime,
			status: detail.status,
			budget: detail.budget,
			revenue: detail.revenue,
			popularity: detail.popularity.toString(),
			voteAverage: detail.vote_average.toString(),
			voteCount: detail.vote_count,
			adult: false,
			syncedAt: now,
			updatedAt: now
		};
		let movieId = existingMovie?.id;
		if (!existingMovie) {
			const [inserted] = await transaction
				.insert(movies)
				.values(movieValues)
				.returning({ id: movies.id });
			movieId = inserted?.id;
		} else if (!existingMovie.isLocked) {
			await transaction.update(movies).set(movieValues).where(eq(movies.id, existingMovie.id));
		}
		if (!movieId) throw new Error(`Movie ${detail.id} could not be persisted.`);

		for (const genre of detail.genres) {
			await transaction
				.insert(genres)
				.values(genre)
				.onConflictDoUpdate({ target: genres.id, set: { name: genre.name } });
			await transaction
				.insert(movieGenres)
				.values({ movieId, genreId: genre.id })
				.onConflictDoNothing();
		}

		let changed = !existingMovie;
		const events = [
			{
				countryCode: 'GLOBAL',
				releaseDate: validDate(detail.release_date),
				releaseType: 'unknown' as const,
				isPrimary: true,
				certification: null,
				note: null,
				sourceEventKey: `tmdb:${detail.id}:global`
			},
			...releaseDates.results.flatMap((region) =>
				region.release_dates.map((release) => {
					const identity = hash({
						certification: release.certification,
						language: release.iso_639_1,
						note: release.note
					}).slice(0, 12);
					return {
						countryCode: /^[A-Z]{2}$/u.test(region.iso_3166_1) ? region.iso_3166_1 : 'GLOBAL',
						releaseDate: validDate(release.release_date.slice(0, 10)),
						releaseType: releaseTypeFromTmdb(release.type),
						isPrimary: false,
						certification: release.certification || null,
						note: release.note || null,
						sourceEventKey: `tmdb:${detail.id}:${region.iso_3166_1}:${release.type}:${release.release_date || 'unknown'}:${identity}`
					};
				})
			)
		];

		for (const event of events) {
			const sourceHash = hash(event);
			const existing = await transaction.query.movieReleaseEvents.findFirst({
				where: eq(movieReleaseEvents.sourceEventKey, event.sourceEventKey),
				columns: { id: true, sourceHash: true }
			});
			if (!existing) {
				await transaction.insert(movieReleaseEvents).values({
					movieId,
					...event,
					sourceHash,
					syncedAt: now
				});
				changed = true;
			} else if (existing.sourceHash !== sourceHash) {
				await transaction
					.update(movieReleaseEvents)
					.set({ ...event, sourceHash, syncedAt: now, updatedAt: now })
					.where(eq(movieReleaseEvents.id, existing.id));
				changed = true;
			}
		}

		for (const snapshot of normalizeProviders(watchProviders)) {
			const sourceHash = hash(snapshot);
			const existing = await transaction.query.movieProviderSnapshots.findFirst({
				where: and(
					eq(movieProviderSnapshots.movieId, movieId),
					eq(movieProviderSnapshots.countryCode, snapshot.countryCode)
				),
				columns: { id: true, sourceHash: true }
			});
			const staleAfter = new Date(now.getTime() + PROVIDER_FRESHNESS_MS);
			if (!existing) {
				await transaction.insert(movieProviderSnapshots).values({
					movieId,
					...snapshot,
					sourceHash,
					capturedAt: now,
					staleAfter
				});
				changed = true;
			} else {
				await transaction
					.update(movieProviderSnapshots)
					.set({ ...snapshot, sourceHash, capturedAt: now, staleAfter, updatedAt: now })
					.where(eq(movieProviderSnapshots.id, existing.id));
				changed ||= existing.sourceHash !== sourceHash;
			}
		}

		return !existingMovie ? 'inserted' : changed ? 'updated' : 'skipped';
	});
}

export async function syncCalendarBatch(
	userId: string,
	input: { runId?: string | null; cursor?: string | null } = {},
	dependencies: SyncDependencies = {}
): Promise<CalendarSyncResult> {
	const client = dependencies.client ?? new TMDBClient();
	const now = dependencies.now ?? new Date();
	let run = input.runId
		? await db.query.calendarSyncRuns.findFirst({
				where: and(eq(calendarSyncRuns.id, input.runId), eq(calendarSyncRuns.requestedBy, userId))
			})
		: null;

	if (input.runId && !run) throw new RangeError('Calendar sync run was not found.');
	if (!run) {
		const discovery = await discoverCalendarCandidates(client, now);
		const [created] = await db
			.insert(calendarSyncRuns)
			.values({
				requestedBy: userId,
				windowStart: discovery.startDate,
				windowEnd: discovery.endDate,
				candidateTmdbIds: discovery.candidates.map((movie) => movie.id)
			})
			.returning();
		if (!created) throw new Error('Calendar sync run could not be created.');
		run = created;
	}

	const requestedCursor =
		input.cursor === undefined || input.cursor === null ? run.cursor : Number(input.cursor);
	if (!Number.isInteger(requestedCursor) || requestedCursor !== run.cursor) {
		throw new RangeError('Calendar sync cursor is stale or invalid.');
	}
	const candidateIds = run.candidateTmdbIds;
	const batchIds = candidateIds.slice(run.cursor, run.cursor + MAX_SYNC_BATCH);

	let inserted = 0;
	let updated = 0;
	let skipped = 0;
	let failed = 0;
	const errors = [...run.errors];
	for (const tmdbId of batchIds) {
		try {
			const outcome = await synchronizeMovie(client, tmdbId, now);
			if (outcome === 'inserted') inserted += 1;
			else if (outcome === 'updated') updated += 1;
			else skipped += 1;
		} catch (error) {
			failed += 1;
			errors.push({ tmdbId, message: safeErrorMessage(error) });
		}
	}

	const nextOffset = run.cursor + batchIds.length;
	const complete = nextOffset >= candidateIds.length;
	const processed = batchIds.length;
	const status = complete ? (run.failed + failed > 0 ? 'partial' : 'complete') : 'running';
	const [updatedRun] = await db
		.update(calendarSyncRuns)
		.set({
			cursor: nextOffset,
			processed: run.processed + processed,
			inserted: run.inserted + inserted,
			updated: run.updated + updated,
			skipped: run.skipped + skipped,
			failed: run.failed + failed,
			errors: errors.slice(-100),
			status,
			completedAt: complete ? now : null,
			updatedAt: now
		})
		.where(and(eq(calendarSyncRuns.id, run.id), eq(calendarSyncRuns.cursor, run.cursor)))
		.returning({ id: calendarSyncRuns.id });
	if (!updatedRun) {
		throw new RangeError('Calendar sync cursor became stale. Reload and retry.');
	}

	return {
		runId: run.id,
		nextCursor: complete ? null : String(nextOffset),
		processed,
		inserted,
		updated,
		skipped,
		failed,
		complete
	};
}

export function parseCalendarQuery(url: URL, settings: Record<string, unknown>): CalendarQuery {
	const score = url.searchParams.get('score');
	const genre = url.searchParams.get('genre');
	return {
		range: parseCalendarRange(url.searchParams.get('range')),
		view: url.searchParams.get('view') === 'month' ? 'month' : 'agenda',
		search: (url.searchParams.get('q') ?? '').trim().slice(0, 100),
		genreId:
			genre !== null && genre !== '' && Number.isInteger(Number(genre)) ? Number(genre) : null,
		releaseType: (() => {
			const value = url.searchParams.get('type');
			return value &&
				[
					'premiere',
					'theatrical_limited',
					'theatrical',
					'digital',
					'physical',
					'tv',
					'unknown'
				].includes(value)
				? (value as ReleaseType)
				: null;
		})(),
		countryCode: normalizeCountryCode(url.searchParams.get('region') ?? settings.calendarCountry),
		watchlist: url.searchParams.get('watchlist') === '1',
		watched: url.searchParams.get('watched') === '1',
		tracked: url.searchParams.get('tracked') === '1',
		alanScore: score === 'unrated' || score === 'partial' || score === 'complete' ? score : 'any'
	};
}

export async function readReleaseCalendar(
	userId: string,
	query: CalendarQuery,
	now = new Date()
): Promise<{
	items: CalendarItem[];
	genres: Array<{ id: number; name: string }>;
	latestSync: {
		status: string;
		processed: number;
		total: number;
		failed: number;
		updatedAt: string;
	} | null;
	stale: boolean;
}> {
	const startDate = now.toISOString().slice(0, 10);
	const endDate = new Date(now.getTime() + (query.range - 1) * 86_400_000)
		.toISOString()
		.slice(0, 10);
	const primary = await db
		.select({ event: movieReleaseEvents, movie: movies })
		.from(movieReleaseEvents)
		.innerJoin(movies, eq(movieReleaseEvents.movieId, movies.id))
		.where(
			and(
				eq(movieReleaseEvents.isPrimary, true),
				or(
					isNull(movieReleaseEvents.releaseDate),
					and(
						gte(movieReleaseEvents.releaseDate, startDate),
						lte(movieReleaseEvents.releaseDate, endDate)
					)
				)
			)
		);
	const movieIds = primary.map(({ movie }) => movie.id);
	// Keep the bounded reads sequential. This avoids multiplying serverless
	// database connections while the result set remains capped at 100 films.
	const regional = movieIds.length
		? await db
				.select()
				.from(movieReleaseEvents)
				.where(
					and(
						inArray(movieReleaseEvents.movieId, movieIds),
						eq(movieReleaseEvents.countryCode, query.countryCode),
						eq(movieReleaseEvents.isPrimary, false),
						or(
							isNull(movieReleaseEvents.releaseDate),
							and(
								gte(movieReleaseEvents.releaseDate, startDate),
								lte(movieReleaseEvents.releaseDate, endDate)
							)
						)
					)
				)
		: [];
	const providers = movieIds.length
		? await db
				.select()
				.from(movieProviderSnapshots)
				.where(
					and(
						inArray(movieProviderSnapshots.movieId, movieIds),
						eq(movieProviderSnapshots.countryCode, query.countryCode)
					)
				)
		: [];
	const interactions = movieIds.length
		? await db
				.select()
				.from(userMovieInteractions)
				.where(
					and(
						eq(userMovieInteractions.userId, userId),
						inArray(userMovieInteractions.movieId, movieIds)
					)
				)
		: [];
	const scores = movieIds.length
		? await db
				.select()
				.from(moviePersonalScores)
				.where(
					and(
						eq(moviePersonalScores.userId, userId),
						inArray(moviePersonalScores.movieId, movieIds)
					)
				)
		: [];
	const reminders = movieIds.length
		? await db
				.select({ reminder: movieReleaseReminders, event: movieReleaseEvents })
				.from(movieReleaseReminders)
				.innerJoin(movieReleaseEvents, eq(movieReleaseReminders.eventId, movieReleaseEvents.id))
				.where(
					and(
						eq(movieReleaseReminders.userId, userId),
						inArray(movieReleaseEvents.movieId, movieIds)
					)
				)
		: [];
	const movieGenreRows = movieIds.length
		? await db.select().from(movieGenres).where(inArray(movieGenres.movieId, movieIds))
		: [];
	const genreRows = await db.select().from(genres).orderBy(genres.name);
	const syncRun = await db.query.calendarSyncRuns.findFirst({
		orderBy: [desc(calendarSyncRuns.startedAt)]
	});

	const regionalByMovie = new Map<string, (typeof regional)[number]>();
	for (const event of regional) {
		const current = regionalByMovie.get(event.movieId);
		const eventKey = `${event.releaseDate || '9999-12-31'}:${event.sourceEventKey}`;
		const currentKey = current
			? `${current.releaseDate || '9999-12-31'}:${current.sourceEventKey}`
			: null;
		if (!current || !currentKey || eventKey < currentKey) {
			regionalByMovie.set(event.movieId, event);
		}
	}
	const providersByMovie = new Map(providers.map((value) => [value.movieId, value]));
	const interactionsByMovie = new Map(interactions.map((value) => [value.movieId, value]));
	const scoresByMovie = new Map(scores.map((value) => [value.movieId, value]));
	const remindersByMovie = new Map<string, typeof reminders>();
	for (const value of reminders) {
		const list = remindersByMovie.get(value.event.movieId) ?? [];
		list.push(value);
		remindersByMovie.set(value.event.movieId, list);
	}
	const genreIdsByMovie = new Map<string, number[]>();
	for (const value of movieGenreRows) {
		genreIdsByMovie.set(value.movieId, [
			...(genreIdsByMovie.get(value.movieId) ?? []),
			value.genreId
		]);
	}
	const genresById = new Map(genreRows.map((genre) => [genre.id, genre]));

	const today = now.toISOString().slice(0, 10);
	const items = primary
		.map(({ event, movie }): CalendarItem => {
			const region = regionalByMovie.get(movie.id);
			const provider = providersByMovie.get(movie.id);
			const interaction = interactionsByMovie.get(movie.id);
			const score = scoresByMovie.get(movie.id);
			const personalReminders = remindersByMovie.get(movie.id) ?? [];
			return {
				eventId: region?.id ?? event.id,
				movieId: movie.id,
				tmdbId: movie.tmdbId,
				title: movie.title,
				posterPath: movie.posterPath,
				date: region?.releaseDate ?? event.releaseDate,
				releaseType: (region?.releaseType ?? event.releaseType) as ReleaseType,
				countryCode: region?.countryCode ?? 'GLOBAL',
				genres: (genreIdsByMovie.get(movie.id) ?? [])
					.map((id) => genresById.get(id))
					.filter((genre): genre is { id: number; name: string } => Boolean(genre)),
				providers: provider?.providers ?? [],
				providerLink: provider?.link ?? null,
				providersStale: Boolean(provider && provider.staleAfter <= now),
				watchlist: interaction?.watchlist ?? false,
				watched: interaction?.watched ?? false,
				tracked: personalReminders.length > 0,
				alanScore:
					score?.computedScore === null || score?.computedScore === undefined
						? null
						: Number(score.computedScore),
				alanScoreStatus: (score?.status ?? 'unrated') as 'unrated' | 'partial' | 'complete',
				reminders: personalReminders.map(({ reminder }) => ({
					id: reminder.id,
					offsetDays: reminder.offsetDays,
					dueDate: reminder.dueDate,
					due: reminder.dueDate <= today
				}))
			};
		})
		.filter(
			(item) =>
				!query.search || item.title.toLocaleLowerCase().includes(query.search.toLocaleLowerCase())
		)
		.filter(
			(item) => query.genreId === null || item.genres.some((genre) => genre.id === query.genreId)
		)
		.filter((item) => query.releaseType === null || item.releaseType === query.releaseType)
		.filter((item) => !query.watchlist || item.watchlist)
		.filter((item) => !query.watched || item.watched)
		.filter((item) => !query.tracked || item.tracked)
		.filter((item) => query.alanScore === 'any' || item.alanScoreStatus === query.alanScore)
		.sort(
			(left, right) =>
				(left.date || '9999-12-31').localeCompare(right.date || '9999-12-31') ||
				left.title.localeCompare(right.title)
		);

	return {
		items,
		genres: genreRows,
		latestSync: syncRun
			? {
					status: syncRun.status,
					processed: syncRun.processed,
					total: syncRun.candidateTmdbIds.length,
					failed: syncRun.failed,
					updatedAt: syncRun.updatedAt.toISOString()
				}
			: null,
		stale: Boolean(syncRun && now.getTime() - syncRun.updatedAt.getTime() > PROVIDER_FRESHNESS_MS)
	};
}

export async function saveCalendarPreferences(
	userId: string,
	currentSettings: Record<string, unknown>,
	input: { countryCode: unknown; timezone: unknown }
) {
	const settings = {
		...currentSettings,
		calendarCountry: normalizeCountryCode(input.countryCode),
		calendarTimezone: normalizeTimezone(input.timezone)
	};
	await db.update(users).set({ settings, updatedAt: new Date() }).where(eq(users.id, userId));
	return settings;
}

export async function createReleaseReminder(
	userId: string,
	eventId: string,
	offsetDays: ReminderOffset,
	timezone: string
) {
	const event = await db.query.movieReleaseEvents.findFirst({
		where: eq(movieReleaseEvents.id, eventId)
	});
	if (!event?.releaseDate) throw new RangeError('A known release date is required for reminders.');
	const values = {
		userId,
		eventId,
		offsetDays,
		timezone: normalizeTimezone(timezone),
		dueDate: reminderDueDate(event.releaseDate, offsetDays),
		updatedAt: new Date()
	};
	const [created] = await db
		.insert(movieReleaseReminders)
		.values(values)
		.onConflictDoUpdate({
			target: [
				movieReleaseReminders.userId,
				movieReleaseReminders.eventId,
				movieReleaseReminders.offsetDays
			],
			set: values
		})
		.returning();
	return created;
}

export async function deleteReleaseReminder(userId: string, reminderId: string): Promise<boolean> {
	const deleted = await db
		.delete(movieReleaseReminders)
		.where(and(eq(movieReleaseReminders.id, reminderId), eq(movieReleaseReminders.userId, userId)))
		.returning({ id: movieReleaseReminders.id });
	return deleted.length > 0;
}

export async function getReleaseReminderIcs(
	userId: string,
	reminderId: string,
	origin: string,
	now = new Date()
): Promise<{ filename: string; contents: string } | null> {
	const [row] = await db
		.select({ reminder: movieReleaseReminders, event: movieReleaseEvents, movie: movies })
		.from(movieReleaseReminders)
		.innerJoin(movieReleaseEvents, eq(movieReleaseReminders.eventId, movieReleaseEvents.id))
		.innerJoin(movies, eq(movieReleaseEvents.movieId, movies.id))
		.where(and(eq(movieReleaseReminders.id, reminderId), eq(movieReleaseReminders.userId, userId)));
	if (!row?.event.releaseDate) return null;
	const slug = row.movie.title
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-|-$/gu, '');
	return {
		filename: `${slug || 'release'}-${row.reminder.offsetDays}d.ics`,
		contents: createReleaseReminderIcs({
			id: row.reminder.id,
			title: `${row.movie.title} release reminder`,
			releaseDate: row.event.releaseDate,
			offsetDays: row.reminder.offsetDays as ReminderOffset,
			timezone: row.reminder.timezone || DEFAULT_CALENDAR_TIMEZONE,
			movieUrl: `${origin}/movies/${row.movie.id}`,
			now
		})
	};
}

export function providerFixture(provider: TMDBWatchProvider): ProviderView {
	return {
		id: provider.provider_id,
		name: provider.provider_name,
		logoPath: provider.logo_path,
		monetizationTypes: [],
		displayPriority: provider.display_priority
	};
}

export function calendarDefaults(settings: Record<string, unknown>) {
	return {
		countryCode: normalizeCountryCode(settings.calendarCountry ?? DEFAULT_CALENDAR_COUNTRY),
		timezone: normalizeTimezone(settings.calendarTimezone ?? DEFAULT_CALENDAR_TIMEZONE)
	};
}
