import { getTop50IMDbTVShows } from '$lib/server/services/tv.service';

const REACHER_HERO = {
	id: 'reacher',
	tmdbId: 108978,
	title: 'REACHER',
	originalTitle: 'Reacher',
	voteAverage: 8.5,
	releaseDate: '2022-02-04',
	genres: [{ name: 'Action' }, { name: 'Crime' }, { name: 'Thriller' }],
	overview:
		'Jack Reacher, a veteran military police investigator, enters civilian life. Carrying no phone and the barest of essentials, he travels the country and dispenses his own brand of justice.',
	backdropPath: 'https://image.tmdb.org/t/p/original/jTqTHJUKi4kMmlmFqJ6O1D0gE8u.jpg', // Reacher high-res
	posterPath: 'https://image.tmdb.org/t/p/w500/jTqTHJUKi4kMmlmFqJ6O1D0gE8u.jpg',
	isTV: true
};

export async function load() {
	const shows = await getTop50IMDbTVShows();

	return {
		featuredHero: REACHER_HERO,
		shows
	};
}
