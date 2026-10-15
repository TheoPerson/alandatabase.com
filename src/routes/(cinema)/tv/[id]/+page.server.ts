import { error } from '@sveltejs/kit';
import type { PosterItem } from '$lib/catalogue/items';
import { getTop50IMDbTVShows } from '$lib/server/services/tv.service';
import type { PageServerLoad } from './$types';

const SIMILAR_LIMIT = 12;

// Series come from the committed IMDb Top TV snapshot: only the fields it really has are shown.
export const load = (async ({ params }) => {
	if (!/^\d{1,9}$/u.test(params.id)) throw error(404, 'Series not found');
	const shows = await getTop50IMDbTVShows();
	const show = shows.find((candidate) => candidate.tmdbId === Number(params.id));
	if (!show) throw error(404, 'Series not found');

	const genres = new Set(show.genres);
	const similar: PosterItem[] = shows
		.filter((other) => other.tmdbId !== show.tmdbId)
		.map((other) => ({ other, shared: other.genres.filter((genre) => genres.has(genre)).length }))
		.filter(({ shared }) => shared > 0)
		.sort((a, b) => b.shared - a.shared || a.other.rank - b.other.rank)
		.slice(0, SIMILAR_LIMIT)
		.map(({ other }) => ({
			id: `tv-${other.tmdbId}`,
			href: `/tv/${other.tmdbId}`,
			title: other.title,
			posterPath: other.posterPath,
			releaseDate: other.firstAirDate,
			rating: other.imdbRating,
			genre: other.genres[0] ?? null
		}));

	return {
		show: {
			tmdbId: show.tmdbId,
			imdbId: show.imdbId ?? null,
			title: show.title,
			rank: show.rank,
			rating: show.imdbRating,
			years: show.year,
			firstYear: show.firstAirDate,
			seasons: show.seasonsCount ?? null,
			posterPath: show.posterPath,
			backdropPath: show.backdropPath,
			overview: show.overview,
			genres: show.genres
		},
		similar
	};
}) satisfies PageServerLoad;
