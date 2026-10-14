import { json } from '@sveltejs/kit';
import { listCatalogue } from '$lib/server/services/catalogue.service';
import { parseCatalogParameters } from '$lib/server/security/request-bounds';
import { logServerError } from '$lib/server/security/logging';

const PAGE_SIZE = 24;

export async function GET({ url }) {
	const parsedParameters = parseCatalogParameters(url);
	if (!parsedParameters.ok) {
		return json({ error: parsedParameters.error }, { status: 400 });
	}

	const { page, genreId, decade, sortBy } = parsedParameters.value;

	let catalogue;
	try {
		catalogue = await listCatalogue({ page, limit: PAGE_SIZE, genreId, decade, sortBy });
	} catch (err) {
		logServerError('Catalog API read failed', err);
		return json({ error: 'The catalogue is temporarily unavailable.' }, { status: 503 });
	}

	const totalPages = Math.ceil(catalogue.totalCount / PAGE_SIZE) || 1;
	const hasMore = page < totalPages && catalogue.movies.length > 0;

	return json({
		movies: catalogue.movies,
		page,
		hasMore,
		totalPages,
		totalCount: catalogue.totalCount
	});
}
