import { getTop50IMDbTVShows } from '$lib/server/services/tv.service';

export async function load() {
	const shows = await getTop50IMDbTVShows();
	const firstShow = shows[0];

	return {
		featuredHero: firstShow
			? {
					...firstShow,
					backdropPath: firstShow.backdropPath
						? `https://image.tmdb.org/t/p/original${firstShow.backdropPath}`
						: null
				}
			: null,
		shows
	};
}
