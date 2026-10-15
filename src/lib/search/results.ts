import { formatRating, formatYear } from '../format';

// What the palette shows for one film. Everything is a plain string: the template
// renders text only, so server data can never become markup.
export interface SearchHit {
	id: string;
	title: string;
	year: string | null;
	rating: string | null;
	posterPath: string | null;
}

// Ids end up in a URL path; anything outside this alphabet is dropped, not escaped.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/u;

function readId(value: unknown): string | null {
	const id = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
	return typeof id === 'string' && SAFE_ID.test(id) ? id : null;
}

function readText(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Validates the body of `GET /api/search` and keeps only entries it can render. */
export function parseSearchResponse(body: unknown): SearchHit[] {
	if (!body || typeof body !== 'object') return [];
	const results = (body as { results?: unknown }).results;
	if (!Array.isArray(results)) return [];

	const seen = new Set<string>();
	const hits: SearchHit[] = [];
	for (const entry of results) {
		if (!entry || typeof entry !== 'object') continue;
		const record = entry as Record<string, unknown>;
		const id = readId(record.id);
		const title = readText(record.title);
		if (!id || !title || seen.has(id)) continue;
		seen.add(id);
		hits.push({
			id,
			title,
			year: formatYear(record.releaseDate),
			rating: formatRating(record.voteAverage),
			posterPath: readText(record.posterPath)
		});
	}
	return hits;
}
