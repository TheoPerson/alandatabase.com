import { getTop50IMDbTVShows } from '$lib/server/services/tv.service';

const REACHER_HERO = {
	id: 'reacher',
	tmdbId: 108978,
	title: 'REACHER',
	originalTitle: 'Reacher',
	voteAverage: 8.1,
	releaseDate: '2022-02-04',
	genres: [{ name: 'Action & Adventure' }, { name: 'Drama' }, { name: 'Crime' }],
	overview:
		'Jack Reacher, a veteran military police investigator, has just recently entered civilian life. Reacher is a drifter, carrying no phone and the barest of essentials as he travels the country and explores the nation he once served.',
	backdropPath: 'https://image.tmdb.org/t/p/original/pF0qkRsrHkdYadPWY9AMeFZfcwk.jpg',
	posterPath: 'https://image.tmdb.org/t/p/w500/f1VCQIG2iCyOookdgOzwtUpwWC0.jpg',
	isTV: true
};

export async function load({ setHeaders }) {
	setHeaders({
		'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
	});

	const shows = await getTop50IMDbTVShows();

	return {
		featuredHero: REACHER_HERO,
		shows
	};
}
