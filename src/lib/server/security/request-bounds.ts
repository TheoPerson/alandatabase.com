export const MAX_SEARCH_QUERY_LENGTH = 120;
export const MAX_CATALOG_PAGE = 500;

export type CatalogSort = 'popularity' | 'rating' | 'release';

type ParseSuccess<T> = {
	ok: true;
	value: T;
};

type ParseFailure = {
	ok: false;
	error: string;
};

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export interface SearchParameters {
	query: string;
	limit: number;
}

export interface CatalogParameters {
	page: number;
	genreId: number | null;
	decade: number | null;
	sortBy: CatalogSort;
}

const WHOLE_NUMBER = /^(0|[1-9]\d*)$/u;
const CATALOG_SORTS = new Set<CatalogSort>(['popularity', 'rating', 'release']);

function containsControlCharacter(value: string): boolean {
	for (const character of value) {
		const codePoint = character.codePointAt(0);
		if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) return true;
	}

	return false;
}

function parseWholeNumber(
	rawValue: string | null,
	name: string,
	minimum: number,
	maximum: number,
	defaultValue: number
): ParseResult<number> {
	if (rawValue === null || rawValue === '') {
		return { ok: true, value: defaultValue };
	}

	if (!WHOLE_NUMBER.test(rawValue)) {
		return { ok: false, error: `${name} must be a whole number.` };
	}

	const value = Number(rawValue);
	if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
		return { ok: false, error: `${name} must be between ${minimum} and ${maximum}.` };
	}

	return { ok: true, value };
}

export function parseSearchParameters(
	url: URL,
	options: { defaultLimit: number; maximumLimit: number }
): ParseResult<SearchParameters> {
	const rawQuery = url.searchParams.get('q') ?? '';
	if (containsControlCharacter(rawQuery)) {
		return { ok: false, error: 'Search query contains unsupported control characters.' };
	}

	const query = rawQuery.trim();

	if (query.length > MAX_SEARCH_QUERY_LENGTH) {
		return {
			ok: false,
			error: `Search query must be ${MAX_SEARCH_QUERY_LENGTH} characters or fewer.`
		};
	}

	const parsedLimit = parseWholeNumber(
		url.searchParams.get('limit'),
		'Search limit',
		1,
		options.maximumLimit,
		options.defaultLimit
	);
	if (!parsedLimit.ok) return parsedLimit;

	return {
		ok: true,
		value: {
			query,
			limit: parsedLimit.value
		}
	};
}

export function parseCatalogParameters(url: URL): ParseResult<CatalogParameters> {
	const parsedPage = parseWholeNumber(
		url.searchParams.get('page'),
		'Catalog page',
		1,
		MAX_CATALOG_PAGE,
		1
	);
	if (!parsedPage.ok) return parsedPage;

	const rawGenre = url.searchParams.get('genre');
	let genreId: number | null = null;
	if (rawGenre !== null) {
		const parsedGenre = parseWholeNumber(rawGenre, 'Genre', 1, 1_000_000, 1);
		if (!parsedGenre.ok) return parsedGenre;
		genreId = parsedGenre.value;
	}

	const rawDecade = url.searchParams.get('decade');
	let decade: number | null = null;
	if (rawDecade !== null) {
		const parsedDecade = parseWholeNumber(rawDecade, 'Decade', 1880, 2100, 2000);
		if (!parsedDecade.ok) return parsedDecade;
		if (parsedDecade.value % 10 !== 0) {
			return { ok: false, error: 'Decade must be the first year of a decade.' };
		}
		decade = parsedDecade.value;
	}

	const rawSort = url.searchParams.get('sort') ?? 'popularity';
	if (!CATALOG_SORTS.has(rawSort as CatalogSort)) {
		return { ok: false, error: 'Catalog sort is not supported.' };
	}

	return {
		ok: true,
		value: {
			page: parsedPage.value,
			genreId,
			decade,
			sortBy: rawSort as CatalogSort
		}
	};
}
