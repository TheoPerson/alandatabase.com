import { and, eq, notInArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { getWorkerDatabase, schema } from '../db.js';
import { evaluateTMDBIngestionSafety } from '../tmdb/ingest-safety.js';
import { TmdbHttp } from './tmdb-http.js';

/** Any Drizzle PostgreSQL database over the app schema (postgres-js in the CLI, PGlite in tests). */
export type WorkerDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface TmdbTvDetail {
	id: number;
	name: string;
	original_name?: string | null;
	overview?: string | null;
	tagline?: string | null;
	poster_path?: string | null;
	backdrop_path?: string | null;
	first_air_date?: string | null;
	last_air_date?: string | null;
	status?: string | null;
	number_of_seasons?: number | null;
	number_of_episodes?: number | null;
	vote_average?: number | null;
	vote_count?: number | null;
	popularity?: number | null;
	original_language?: string | null;
	adult?: boolean | null;
	genres?: Array<{ id: number; name: string }>;
	keywords?: { results?: Array<{ id: number; name: string }> | null } | null;
	external_ids?: { imdb_id?: string | null } | null;
	seasons?: Array<{
		season_number: number;
		name?: string | null;
		overview?: string | null;
		poster_path?: string | null;
		air_date?: string | null;
		episode_count?: number | null;
	}>;
}

export interface TmdbSeasonDetail {
	season_number: number;
	name?: string | null;
	overview?: string | null;
	poster_path?: string | null;
	air_date?: string | null;
	episodes?: Array<{
		season_number?: number;
		episode_number: number;
		name?: string | null;
		overview?: string | null;
		still_path?: string | null;
		air_date?: string | null;
		runtime?: number | null;
		vote_average?: number | null;
		vote_count?: number | null;
	}>;
}

/** Where show and season payloads come from (TMDB in production, a fake in tests). */
export interface TvSource {
	getShow(tmdbId: number): Promise<TmdbTvDetail | null>;
	getSeason(tmdbId: number, seasonNumber: number): Promise<TmdbSeasonDetail | null>;
}

export function createTmdbTvSource(http: TmdbHttp = new TmdbHttp()): TvSource {
	return {
		getShow: (tmdbId) =>
			http.get<TmdbTvDetail>(`/tv/${tmdbId}`, { append_to_response: 'keywords,external_ids' }),
		getSeason: (tmdbId, seasonNumber) =>
			http.get<TmdbSeasonDetail>(`/tv/${tmdbId}/season/${seasonNumber}`)
	};
}

export type EpisodeKey = `${number}x${number}`;

export function episodeKey(season: number, episode: number): EpisodeKey {
	return `${season}x${episode}`;
}

export type TvIngestResult =
	| {
			status: 'ingested' | 'locked';
			showId: string;
			name: string;
			episodes: Map<EpisodeKey, string>;
	  }
	| { status: 'blocked'; reason: string }
	| { status: 'not-found' }
	| { status: 'failed'; error: string };

export interface IngestTvOptions {
	/** Seasons whose episodes are fetched and stored ('all' = every season TMDB lists). */
	seasons?: number[] | 'all';
	db?: WorkerDb;
	source?: TvSource;
	log?: (message: string) => void;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

function date(value: string | null | undefined): string | null {
	return typeof value === 'string' && DATE.test(value) ? value : null;
}

function text(value: string | null | undefined): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function count(value: number | null | undefined): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/** TMDB reports 0 for "nobody voted": keep that unknown instead of storing a fake 0.0 rating. */
function rating(average: number | null | undefined, votes: number | null | undefined) {
	if (typeof average !== 'number' || !Number.isFinite(average) || average <= 0) return null;
	if (typeof votes === 'number' && votes <= 0) return null;
	return Math.min(average, 10).toFixed(1);
}

async function readEpisodeMap(db: WorkerDb, showId: string): Promise<Map<EpisodeKey, string>> {
	const rows = await db
		.select({
			id: schema.tvEpisodes.id,
			season: schema.tvEpisodes.seasonNumber,
			episode: schema.tvEpisodes.episodeNumber
		})
		.from(schema.tvEpisodes)
		.where(eq(schema.tvEpisodes.showId, showId));
	return new Map(rows.map((row) => [episodeKey(row.season, row.episode), row.id]));
}

/**
 * Ingest one TV show (and the episodes of the requested seasons) from TMDB.
 *
 * Order matters: classification (adult flag + explicit keywords) is evaluated before the first
 * database write, a locked show is never modified, and every write for the show happens in one
 * short transaction after all network calls are done. Upserts make re-runs idempotent.
 */
export async function ingestTvShow(
	tmdbId: number,
	options: IngestTvOptions = {}
): Promise<TvIngestResult> {
	const log = options.log ?? (() => undefined);
	if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return { status: 'failed', error: 'bad id' };
	const source = options.source ?? createTmdbTvSource();

	try {
		const detail = await source.getShow(tmdbId);
		if (!detail) return { status: 'not-found' };

		const safety = evaluateTMDBIngestionSafety({
			adult: detail.adult,
			keywords: { keywords: detail.keywords?.results ?? null }
		});
		// Classification must succeed before the first database write below.
		if (!safety.allowed) {
			log(`Blocked TMDB TV #${tmdbId} before ingestion: ${safety.reason}.`);
			return { status: 'blocked', reason: safety.reason };
		}

		const db = options.db ?? (getWorkerDatabase() as unknown as WorkerDb);

		const [existing] = await db
			.select({ id: schema.tvShows.id, isLocked: schema.tvShows.isLocked })
			.from(schema.tvShows)
			.where(eq(schema.tvShows.tmdbId, detail.id))
			.limit(1);
		if (existing?.isLocked) {
			log(`Skipping TMDB TV #${tmdbId}: show row is locked.`);
			return {
				status: 'locked',
				showId: existing.id,
				name: detail.name,
				episodes: await readEpisodeMap(db, existing.id)
			};
		}

		// Network first, then one short transaction.
		const listedSeasons = (detail.seasons ?? []).map((season) => season.season_number);
		const wanted =
			options.seasons === 'all'
				? listedSeasons
				: [...new Set(options.seasons ?? [])].filter((n) => Number.isInteger(n) && n >= 0);
		const seasonDetails: TmdbSeasonDetail[] = [];
		for (const seasonNumber of wanted) {
			const season = await source.getSeason(detail.id, seasonNumber);
			if (season) seasonDetails.push(season);
		}

		const showId = await db.transaction(async (tx) => {
			const updatable = {
				name: detail.name,
				originalName: text(detail.original_name),
				overview: text(detail.overview),
				tagline: text(detail.tagline),
				posterPath: text(detail.poster_path),
				backdropPath: text(detail.backdrop_path),
				firstAirDate: date(detail.first_air_date),
				lastAirDate: date(detail.last_air_date),
				status: text(detail.status),
				numberOfSeasons: count(detail.number_of_seasons),
				numberOfEpisodes: count(detail.number_of_episodes),
				voteAverage: rating(detail.vote_average, detail.vote_count),
				voteCount: count(detail.vote_count),
				popularity:
					typeof detail.popularity === 'number' && Number.isFinite(detail.popularity)
						? detail.popularity
						: null,
				originalLanguage: text(detail.original_language),
				imdbId: text(detail.external_ids?.imdb_id),
				adult: false,
				syncedAt: new Date()
			};
			const values = { tmdbId: detail.id, ...updatable };
			const [show] = await tx
				.insert(schema.tvShows)
				.values(values)
				.onConflictDoUpdate({
					target: schema.tvShows.tmdbId,
					set: { ...updatable, updatedAt: new Date() },
					where: eq(schema.tvShows.isLocked, false)
				})
				.returning({ id: schema.tvShows.id });
			// Locked between the pre-check and this write: write nothing else.
			if (!show) return null;

			const genreRows = detail.genres ?? [];
			const genreIds = genreRows.map((genre) => genre.id);
			if (genreRows.length > 0) {
				// TV genre ids (10759, 10765, ...) join the shared table; existing names are kept.
				await tx
					.insert(schema.genres)
					.values(genreRows.map((genre) => ({ id: genre.id, name: genre.name })))
					.onConflictDoNothing();
			}
			await tx
				.delete(schema.tvGenres)
				.where(
					genreIds.length > 0
						? and(
								eq(schema.tvGenres.showId, show.id),
								notInArray(schema.tvGenres.genreId, genreIds)
							)
						: eq(schema.tvGenres.showId, show.id)
				);
			if (genreIds.length > 0) {
				await tx
					.insert(schema.tvGenres)
					.values(genreIds.map((genreId) => ({ showId: show.id, genreId })))
					.onConflictDoNothing();
			}

			const keywordRows = detail.keywords?.results ?? [];
			const keywordIds = keywordRows.map((keyword) => keyword.id);
			if (keywordRows.length > 0) {
				await tx
					.insert(schema.keywords)
					.values(keywordRows.map((keyword) => ({ id: keyword.id, name: keyword.name })))
					.onConflictDoNothing();
			}
			await tx
				.delete(schema.tvKeywords)
				.where(
					keywordIds.length > 0
						? and(
								eq(schema.tvKeywords.showId, show.id),
								notInArray(schema.tvKeywords.keywordId, keywordIds)
							)
						: eq(schema.tvKeywords.showId, show.id)
				);
			if (keywordIds.length > 0) {
				await tx
					.insert(schema.tvKeywords)
					.values(keywordIds.map((keywordId) => ({ showId: show.id, keywordId })))
					.onConflictDoNothing();
			}

			// Season rows: TMDB's summary list, refined by any season fetched in full.
			const seasonsByNumber = new Map<number, typeof schema.tvSeasons.$inferInsert>();
			for (const season of detail.seasons ?? []) {
				seasonsByNumber.set(season.season_number, {
					showId: show.id,
					seasonNumber: season.season_number,
					name: text(season.name),
					overview: text(season.overview),
					posterPath: text(season.poster_path),
					airDate: date(season.air_date),
					episodeCount: count(season.episode_count)
				});
			}
			for (const season of seasonDetails) {
				const summary = seasonsByNumber.get(season.season_number);
				seasonsByNumber.set(season.season_number, {
					showId: show.id,
					seasonNumber: season.season_number,
					name: text(season.name) ?? summary?.name ?? null,
					overview: text(season.overview) ?? summary?.overview ?? null,
					posterPath: text(season.poster_path) ?? summary?.posterPath ?? null,
					airDate: date(season.air_date) ?? summary?.airDate ?? null,
					episodeCount: summary?.episodeCount ?? count(season.episodes?.length)
				});
			}
			const seasonIdByNumber = new Map<number, string>();
			if (seasonsByNumber.size > 0) {
				const rows = await tx
					.insert(schema.tvSeasons)
					.values([...seasonsByNumber.values()])
					.onConflictDoUpdate({
						target: [schema.tvSeasons.showId, schema.tvSeasons.seasonNumber],
						set: {
							name: sql`excluded."name"`,
							overview: sql`excluded."overview"`,
							posterPath: sql`excluded."poster_path"`,
							airDate: sql`excluded."air_date"`,
							episodeCount: sql`excluded."episode_count"`
						}
					})
					.returning({ id: schema.tvSeasons.id, seasonNumber: schema.tvSeasons.seasonNumber });
				for (const row of rows) seasonIdByNumber.set(row.seasonNumber, row.id);
			}

			const episodeRows: Array<typeof schema.tvEpisodes.$inferInsert> = [];
			for (const season of seasonDetails) {
				const seasonId = seasonIdByNumber.get(season.season_number);
				if (!seasonId) continue;
				for (const episode of season.episodes ?? []) {
					if (!Number.isInteger(episode.episode_number) || episode.episode_number < 0) continue;
					episodeRows.push({
						showId: show.id,
						seasonId,
						seasonNumber: season.season_number,
						episodeNumber: episode.episode_number,
						name: text(episode.name),
						overview: text(episode.overview),
						stillPath: text(episode.still_path),
						airDate: date(episode.air_date),
						runtime: count(episode.runtime),
						voteAverage: rating(episode.vote_average, episode.vote_count)
					});
				}
			}
			if (episodeRows.length > 0) {
				await tx
					.insert(schema.tvEpisodes)
					.values(episodeRows)
					.onConflictDoUpdate({
						target: [
							schema.tvEpisodes.showId,
							schema.tvEpisodes.seasonNumber,
							schema.tvEpisodes.episodeNumber
						],
						set: {
							seasonId: sql`excluded."season_id"`,
							name: sql`excluded."name"`,
							overview: sql`excluded."overview"`,
							stillPath: sql`excluded."still_path"`,
							airDate: sql`excluded."air_date"`,
							runtime: sql`excluded."runtime"`,
							voteAverage: sql`excluded."vote_average"`
						}
					});
			}
			return show.id;
		});

		if (!showId) {
			const [row] = await db
				.select({ id: schema.tvShows.id })
				.from(schema.tvShows)
				.where(eq(schema.tvShows.tmdbId, detail.id))
				.limit(1);
			if (!row) return { status: 'failed', error: 'show row vanished' };
			return {
				status: 'locked',
				showId: row.id,
				name: detail.name,
				episodes: await readEpisodeMap(db, row.id)
			};
		}

		log(`Ingested TV "${detail.name}" (${seasonDetails.length} season(s) with episodes).`);
		return {
			status: 'ingested',
			showId,
			name: detail.name,
			episodes: await readEpisodeMap(db, showId)
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'unknown error';
		log(`TV ingestion failed for TMDB #${tmdbId}: ${message}`);
		return { status: 'failed', error: message };
	}
}
