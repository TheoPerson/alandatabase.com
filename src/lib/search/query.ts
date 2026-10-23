// Shared by the palette and the header search: what counts as a query, when it is
// worth asking the server, and where "see all results" goes.

/** Matches the server bound in `parseSearchParameters`. */
export const MAX_QUERY_LENGTH = 120;
/** A single letter matches half the catalogue: the palette waits for two. */
export const MIN_PREVIEW_LENGTH = 2;

// The API answers 400 to control characters, so they become plain spaces here.
// eslint-disable-next-line no-control-regex
const CONTROL_OR_SPACE_RUN = /[\u0000-\u001f\u007f\s]+/gu;

export function normalizeQuery(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.replace(CONTROL_OR_SPACE_RUN, ' ').trim().slice(0, MAX_QUERY_LENGTH).trimEnd();
}

export function canPreview(value: unknown): boolean {
	return [...normalizeQuery(value)].length >= MIN_PREVIEW_LENGTH;
}

export function searchHref(value: unknown): string {
	const query = normalizeQuery(value);
	return query ? `/search?q=${encodeURIComponent(query)}` : '/search';
}
