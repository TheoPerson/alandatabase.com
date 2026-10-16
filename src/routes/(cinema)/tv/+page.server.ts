import type { HeroItem, PosterItem } from '$lib/catalogue/items';
import { getTop50IMDbTVShows, type TVShowSummary } from '$lib/server/services/tv.service';
import type { PageServerLoad } from './$types';

const FEATURED_COUNT = 5;

function toPoster(show: TVShowSummary): PosterItem {
	return {
		id: `tv-${show.tmdbId}`,
		href: `/tv/${show.tmdbId}`,
		title: show.title,
		posterPath: show.posterPath,
		releaseDate: show.firstAirDate,
		rating: show.imdbRating,
		genre: show.genres[0] ?? null
	};
}

// The landing reads the committed IMDb Top TV snapshot; the genre filter is a plain link (?genre=).
export const load = (async ({ url }) => {
	const shows = [...(await getTop50IMDbTVShows())].sort((a, b) => a.rank - b.rank);
	const genres = [...new Set(shows.flatMap((show) => show.genres))].sort((a, b) =>
		a.localeCompare(b)
	);
	const requested = url.searchParams.get('genre');
	const genre = requested && genres.includes(requested) ? requested : null;

	const featured: HeroItem[] = shows.slice(0, FEATURED_COUNT).map((show) => ({
		...toPoster(show),
		backdropPath: show.backdropPath,
		overview: show.overview,
		genres: show.genres.slice(0, 3)
	}));

	return {
		featured,
		top10: shows.slice(0, 10).map(toPoster),
		shows: shows
			.filter((show) => !genre || show.genres.includes(genre))
			.map((show) => ({ ...toPoster(show), genres: show.genres })),
		genres,
		genre,
		total: shows.length
	};
}) satisfies PageServerLoad;
