import { getTVShowDetails } from '$lib/server/services/tv.service';
import { error } from '@sveltejs/kit';

export async function load({ params, setHeaders }) {
	const tmdbId = parseInt(params.id, 10);
	if (isNaN(tmdbId)) {
		throw error(404, { message: 'Invalid TV show ID' });
	}

	setHeaders({
		'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
	});

	try {
		const show = await getTVShowDetails(tmdbId);
		if (!show || !show.name) {
			throw error(404, { message: 'TV Show not found' });
		}

		return {
			show
		};
	} catch (err: any) {
		throw error(404, { message: 'TV Show not found in archive' });
	}
}
