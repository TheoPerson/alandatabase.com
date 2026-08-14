import { getTop50IMDbTVShows } from '$lib/server/services/tv.service';

export async function load({ setHeaders }) {
	setHeaders({
		'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
	});

	const shows = await getTop50IMDbTVShows();

	return {
		shows
	};
}
