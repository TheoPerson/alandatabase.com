import {
	getOrCreateDefaultUser,
	getUserWatchlist,
	getUserFavorites,
	getUserWatchedHistory,
	getUserStats
} from '$lib/server/services/interaction.service';

export async function load() {
	const user = await getOrCreateDefaultUser();

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
