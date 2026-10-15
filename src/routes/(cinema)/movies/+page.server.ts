import { error, redirect } from '@sveltejs/kit';
import { browseHref } from '$lib/catalogue/browse';
import type { PosterItem } from '$lib/catalogue/items';
import { logServerError } from '$lib/server/security/logging';
import { parseCatalogParameters } from '$lib/server/security/request-bounds';
import { listCatalogue } from '$lib/server/services/catalogue.service';
import { getGenres, toPosterItem } from '$lib/server/services/movie.service';

const PAGE_SIZE = 24;

// Browse is public and personal-state free: no session, no writes, only bounded local reads.
export async function load({ url }) {
	const parsed = parseCatalogParameters(url);
	if (!parsed.ok) error(400, parsed.error);

	const { page, ...filters } = parsed.value;

	const [catalogue, genres] = await Promise.allSettled([
		listCatalogue({ page, limit: PAGE_SIZE, ...filters }),
		getGenres()
	]);

	let items: PosterItem[] = [];
	let totalCount = 0;
	let unavailable = false;
	if (catalogue.status === 'fulfilled') {
		items = catalogue.value.movies.map(toPosterItem);
		totalCount = catalogue.value.totalCount;
	} else {
		logServerError('Browse catalogue read failed', catalogue.reason);
		unavailable = true;
	}

	if (genres.status === 'rejected') logServerError('Browse genre list failed', genres.reason);

	const totalPages = Math.ceil(totalCount / PAGE_SIZE);
	// A stale link past the end lands on the last page instead of an empty grid.
	if (totalPages > 0 && page > totalPages) redirect(307, browseHref(filters, totalPages));

	return {
		items,
		genres: genres.status === 'fulfilled' ? genres.value : [],
		filters,
		pagination: { page, pageSize: PAGE_SIZE, totalCount, totalPages },
		unavailable
	};
}
