import { getTrendingMovies, getTopRatedMovies } from '$lib/server/services/movie.service';
import { db } from '$lib/server/db/index.js';

export async function load() {
	const [allMovies, topRated, genreList] = await Promise.all([
		getTrendingMovies(50000), // High limit to load "all" movies for the client-side filtering/sorting
		getTopRatedMovies(20),
		db.query.genres.findMany()
	]);

	return {
		allMovies,
		topRated,
		genreList
	};
}
