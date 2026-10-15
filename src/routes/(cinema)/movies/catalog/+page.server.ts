import { redirect } from '@sveltejs/kit';
import { browseHref, BROWSE_PATH } from '$lib/catalogue/browse';
import { parseCatalogParameters } from '$lib/server/security/request-bounds';

// The old catalogue grid is now Browse at /movies. Old links, bookmarks and search results keep
// working: the supported filters carry over, anything invalid lands on the plain Browse page.
export function load({ url }) {
	const parsed = parseCatalogParameters(url);
	if (!parsed.ok) redirect(308, BROWSE_PATH);

	const { page, ...filters } = parsed.value;
	redirect(308, browseHref(filters, page));
}
