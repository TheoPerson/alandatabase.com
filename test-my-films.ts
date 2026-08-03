import { db } from './src/lib/server/db/index.js';
import { getOrCreateDefaultUser, getUserWatchlist, getUserFavorites, getUserWatchedHistory, getUserStats } from './src/lib/server/services/interaction.service.js';

async function main() {
	try {
		console.log('Getting user...');
		const user = await getOrCreateDefaultUser();
		console.log('User:', user.id);

		console.log('Getting watchlist...');
		await getUserWatchlist(user.id);
		console.log('Getting favorites...');
		await getUserFavorites(user.id);
		console.log('Getting watched...');
		await getUserWatchedHistory(user.id);
		console.log('Getting stats...');
		await getUserStats(user.id);

		console.log('All succeeded!');
	} catch (e) {
		console.error('Failed:', e);
	}
}
main();
