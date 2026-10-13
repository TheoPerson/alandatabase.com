import { error, fail } from '@sveltejs/kit';
import {
	collectionMovies,
	getMovieById,
	similarMovies,
	toHeroItem,
	toPosterItem
} from '$lib/server/services/movie.service';
import {
	applyInteraction,
	getUserInteraction,
	getUserMovieReviews,
	parseInteractionUpdate
} from '$lib/server/services/interaction.service';
import { hasPermission } from '$lib/server/auth/permissions';
import { groupProviders, keyCrew, pickTrailers } from '$lib/catalogue/detail';
import { logServerError } from '$lib/server/security/logging';
import type { Actions, PageServerLoad } from './$types';

type Movie = NonNullable<Awaited<ReturnType<typeof getMovieById>>>;

interface CrewPerson {
	id: string;
	name: string;
	job: string;
}

// The service returns an untyped relational row; these are the slices the page reads.
interface GenreRelation {
	genre?: { id: number; name: string } | null;
}

interface CastCredit {
	character: string | null;
	person: { id: string; name: string; profilePath: string | null } | null;
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T, context: string): T {
	if (result.status === 'fulfilled') return result.value;
	logServerError(context, result.reason);
	return fallback;
}

// Crew grouped by department in first-seen order; the ingest already sorts by importance.
function crewByDepartment(movie: Movie): Array<{ department: string; people: CrewPerson[] }> {
	const departments = new Map<string, CrewPerson[]>();
	for (const row of movie.crew ?? []) {
		if (!row.person) continue;
		const department = row.department || 'Crew';
		const list = departments.get(department) ?? [];
		list.push({ id: row.person.id, name: row.person.name, job: row.job ?? '' });
		departments.set(department, list);
	}
	return [...departments].map(([department, people]) => ({ department, people }));
}

interface ReviewRow {
	id: string;
	content: string;
	containsSpoilers?: boolean | null;
	createdAt?: Date | string | null;
	user?: { username?: string | null; displayName?: string | null } | null;
}

// Dates travel as ISO day strings so the page formats them without guessing the type.
function toReviewItem(row: ReviewRow) {
	const created =
		row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? '');
	return {
		id: row.id,
		content: row.content,
		containsSpoilers: Boolean(row.containsSpoilers),
		createdAt: /^\d{4}-\d{2}-\d{2}/u.test(created) ? created.slice(0, 10) : null,
		author: row.user?.displayName || row.user?.username || 'Member'
	};
}

function toNumberOrNull(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

export const load = (async ({ params, locals }) => {
	const user = hasPermission(locals.user, 'account:access') ? locals.user : null;

	let movie: Movie | null;
	try {
		movie = await getMovieById(params.id);
	} catch (err) {
		logServerError('Movie details load failed', err);
		throw error(500, 'Failed to load movie details');
	}
	if (!movie) throw error(404, 'Movie not found');

	const genres = ((movie.genres ?? []) as GenreRelation[])
		.map((relation) => relation.genre)
		.filter((genre): genre is { id: number; name: string } => Boolean(genre));
	const primaryGenreId = genres[0]?.id ?? null;

	const [similar, saga, interaction, reviews] = await Promise.allSettled([
		similarMovies(movie.id, primaryGenreId),
		collectionMovies(movie.collectionId ?? null, movie.id),
		user ? getUserInteraction(user.id, movie.id) : Promise.resolve(null),
		getUserMovieReviews(movie.id)
	]);

	const personal = settled(interaction, null, 'Detail interaction read failed');
	const sagaItems = settled(saga, [], 'Detail collection read failed').map(toPosterItem);
	const providers = movie.watchProviders ?? [];

	return {
		user,
		hero: toHeroItem(movie),
		posterPath: movie.posterPath ?? null,
		tagline: movie.tagline ?? null,
		overview: movie.overview ?? null,
		voteCount: movie.voteCount ?? null,
		genres,
		trailers: pickTrailers(movie.videos ?? []),
		keyCrew: keyCrew(movie.crew ?? []),
		cast: ((movie.cast ?? []) as CastCredit[])
			.filter((credit): credit is CastCredit & { person: NonNullable<CastCredit['person']> } =>
				Boolean(credit.person)
			)
			.map((credit) => ({
				id: credit.person.id,
				name: credit.person.name,
				profilePath: credit.person.profilePath ?? null,
				character: credit.character ?? null
			})),
		crewByDepartment: crewByDepartment(movie),
		providers: {
			FR: groupProviders(providers, 'FR'),
			US: groupProviders(providers, 'US')
		},
		similar: settled(similar, [], 'Detail similar read failed').map(toPosterItem),
		saga:
			sagaItems.length > 0
				? { name: movie.collection?.name ?? 'Collection', items: sagaItems }
				: null,
		details: {
			releaseDate: movie.releaseDate ?? null,
			runtime: movie.runtime ?? null,
			originalTitle: movie.originalTitle ?? null,
			originalLanguage: movie.originalLanguage ?? null,
			status: movie.status ?? null,
			budget: movie.budget ?? null,
			revenue: movie.revenue ?? null,
			tmdbId: movie.tmdbId,
			imdbId: movie.imdbId ?? null,
			keywords: movie.keywordNames ?? []
		},
		interaction: personal
			? {
					watched: Boolean(personal.watched),
					watchlist: Boolean(personal.watchlist),
					favorite: Boolean(personal.favorite),
					rating: toNumberOrNull(personal.rating)
				}
			: null,
		reviews: settled(reviews, [], 'Detail reviews read failed').map(toReviewItem)
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	// One field per submit: watched | watchlist | favorite as 'true'/'false', or rating 0.5–5 ('' clears).
	logInteraction: async ({ request, locals, params }) => {
		if (!locals.user) return fail(401, { error: 'Sign in to log films.' });
		if (!hasPermission(locals.user, 'account:access')) {
			return fail(403, { error: 'Personal film activity needs a signed-in account.' });
		}

		const data = await request.formData();
		const update = parseInteractionUpdate(
			data.get('type')?.toString(),
			data.get('value')?.toString()
		);
		if (!update.ok) return fail(400, { error: update.error });

		try {
			const interaction = await applyInteraction(locals.user.id, params.id, update);
			if (!interaction) return fail(404, { error: 'Could not resolve movie record.' });
			return { success: true, interaction };
		} catch (err) {
			logServerError('Movie interaction update failed', err);
			return fail(500, { error: 'Failed to update interaction.' });
		}
	}
};
