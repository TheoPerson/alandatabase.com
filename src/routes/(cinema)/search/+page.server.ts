import { searchMovies } from '$lib/server/services/movie.service';
import { notifySearchPerformed } from '$lib/server/services/telegram.service';

export async function load({ url }) {
	const query = url.searchParams.get('q') || '';
	let results: any[] = [];

	if (query.trim()) {
		try {
			results = await searchMovies(query.trim(), 30);
			notifySearchPerformed(query.trim(), results.length).catch(() => {});
		} catch (err) {
			results = [];
		}
	}

	return {
		query,
		results
	};
}
