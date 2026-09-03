import { db } from '$lib/server/db';
import { genres } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders, locals }) => {
	if (!locals.user) {
		setHeaders({
			'cache-control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300'
		});
	}

	// Fetch standard genre list from DB
	const dbGenres = await db.select().from(genres).catch(() => []);
	const genreNames = dbGenres.map((g) => g.name).sort();

	return {
		genres: genreNames.length > 0 ? genreNames : [
			'Action',
			'Adventure',
			'Animation',
			'Comedy',
			'Crime',
			'Documentary',
			'Drama',
			'Family',
			'Fantasy',
			'History',
			'Horror',
			'Mystery',
			'Romance',
			'Science Fiction',
			'Thriller',
			'War',
			'Western'
		]
	};
};
