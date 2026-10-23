import { db } from '$lib/server/db';
import { genres } from '$lib/server/db/schema';
import { pickerBackdrops } from '$lib/components/picker/picker-view';
import { getUserWatchlist } from '$lib/server/services/interaction.service';
import { logServerError } from '$lib/server/security/logging';
import type { PageServerLoad } from './$types';

// Ambient artwork for the idle stage: the newest films on the viewer's own watchlist (the
// service already drops anything outside the standard catalogue). A failure only empties the strip.
async function watchlistBackdrops(userId: string | undefined): Promise<string[]> {
	if (!userId) return [];
	try {
		const rows = await getUserWatchlist(userId);
		return pickerBackdrops(rows.map((row) => row.movie ?? {}));
	} catch (err) {
		logServerError('Picker backdrops failed', err);
		return [];
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const backdrops = watchlistBackdrops(locals.user?.id);
	// Fetch standard genre list from DB
	const dbGenres = await db
		.select()
		.from(genres)
		.catch(() => []);
	const genreNames = dbGenres.map((g) => g.name).sort();

	return {
		backdrops: await backdrops,
		genres:
			genreNames.length > 0
				? genreNames
				: [
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
