import { redirect } from '@sveltejs/kit';
import {
	getUserWatchlist,
	getUserFavorites,
	getUserWatchedHistory,
	getUserStats
} from '$lib/server/services/interaction.service';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const user = locals.user;

	const [watchlist, favorites, watched, stats] = await Promise.all([
		getUserWatchlist(user.id),
		getUserFavorites(user.id),
		getUserWatchedHistory(user.id),
		getUserStats(user.id)
	]);

	return {
		user,
		watchlist,
		favorites,
		watched,
		stats
	};
}
