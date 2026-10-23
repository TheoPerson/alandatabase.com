import { db } from '$lib/server/db';
import { movies, movieGenres } from '$lib/server/db/schema';
import { and, desc, eq, exists, inArray, sql } from 'drizzle-orm';
import type { HeroItem, PosterItem } from '$lib/catalogue/items';
import { browseHref, DEFAULT_SORT } from '$lib/catalogue/browse';
import { prepareStandardMovies } from '$lib/server/queries/local-movie-search';
import { standardMovieVisibilityWhere } from '$lib/server/policies/movie-visibility';
import { listCatalogue } from '$lib/server/services/catalogue.service';
import { toHeroItem, toPosterItem } from '$lib/server/services/movie.service';
import { logServerError } from '$lib/server/security/logging';
import type { PageServerLoad } from './$types';

const RAIL_LIMIT = 12;

// Moods are fixed genre blends; the first genre is where "See all" leads in Browse.
const MOODS = [
	{
		key: 'mind-bending',
		title: 'Mind-bending',
		subtitle: 'Science fiction, thrillers and mysteries',
		genres: [878, 53, 9648]
	},
	{
		key: 'late-night',
		title: 'Late-night comfort',
		subtitle: 'Comedy, romance and music',
		genres: [35, 10749, 10402]
	},
	{
		key: 'adrenaline',
		title: 'Adrenaline',
		subtitle: 'Action, crime and war',
		genres: [28, 80, 10752]
	},
	{
		key: 'family',
		title: 'Family night',
		subtitle: 'Animation, family and adventure',
		genres: [16, 10751, 12]
	}
] as const;

const DECADES = [2010, 2000, 1990, 1980] as const;

async function moodMovies(genreIds: readonly number[]) {
	const rows = await db.query.movies.findMany({
		where: and(
			standardMovieVisibilityWhere(),
			exists(
				db
					.select({ movieId: movieGenres.movieId })
					.from(movieGenres)
					.where(
						and(eq(movieGenres.movieId, movies.id), inArray(movieGenres.genreId, [...genreIds]))
					)
			)
		),
		orderBy: [desc(movies.popularity), desc(movies.id)],
		limit: RAIL_LIMIT,
		with: { keywords: true, genres: { with: { genre: true } } }
	});
	return prepareStandardMovies(rows);
}

async function wellRated() {
	const rows = await db.query.movies.findMany({
		where: and(sql`${movies.voteCount} > 1000`, standardMovieVisibilityWhere()),
		orderBy: [desc(movies.voteAverage), desc(movies.id)],
		limit: 10,
		with: { keywords: true, genres: { with: { genre: true } } }
	});
	return prepareStandardMovies(rows);
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T, context: string): T {
	if (result.status === 'fulfilled') return result.value;
	logServerError(context, result.reason);
	return fallback;
}

// Every rail is independent: one failing query empties that rail, never the page.
export const load = (async () => {
	const [pickResult, ...rest] = await Promise.allSettled([
		wellRated(),
		...MOODS.map((mood) => moodMovies(mood.genres)),
		...DECADES.map((decade) =>
			listCatalogue({
				page: 1,
				limit: RAIL_LIMIT,
				genreId: null,
				decade,
				minRating: null,
				sortBy: 'rating'
			}).then((result) => result.movies)
		)
	]);
	const moodResults = rest.slice(0, MOODS.length);
	const decadeResults = rest.slice(MOODS.length);

	// Stable for the whole UTC day so the pick does not change on refresh.
	const candidates = settled(pickResult, [], 'Discover pick failed');
	const utcDay = Math.floor(Date.now() / 86_400_000);
	const pick: HeroItem | null = candidates.length
		? toHeroItem(candidates[utcDay % candidates.length])
		: null;

	const moods = MOODS.map((mood, index) => ({
		key: mood.key,
		title: mood.title,
		subtitle: mood.subtitle,
		seeAllHref: browseHref({
			genreId: mood.genres[0],
			decade: null,
			minRating: null,
			sortBy: DEFAULT_SORT
		}),
		items: settled(moodResults[index], [], `Discover ${mood.key} rail failed`).map(
			toPosterItem
		) as PosterItem[]
	})).filter((rail) => rail.items.length > 0);

	const decades = DECADES.map((decade, index) => ({
		decade,
		title: `Best of the ${decade}s`,
		seeAllHref: browseHref({ genreId: null, decade, minRating: null, sortBy: 'rating' }),
		items: settled(decadeResults[index], [], `Discover ${decade}s rail failed`).map(
			toPosterItem
		) as PosterItem[]
	})).filter((rail) => rail.items.length > 0);

	return {
		pick,
		moods,
		decades,
		degraded: [pickResult, ...rest].some((result) => result.status === 'rejected')
	};
}) satisfies PageServerLoad;
