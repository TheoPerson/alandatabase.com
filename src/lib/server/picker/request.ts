import { QUICK_PRESETS } from '$lib/picker/presets';
import type {
	PickerActionType,
	PickerEventPayload,
	PickerFilters,
	PickerPreset,
	RecommendationMode
} from '$lib/picker/types';
import type { ParseResult } from '$lib/server/security/request-bounds';

// Request bounds for the picker API. Everything the client sends is untrusted:
// it reaches SQL filters, the activity diary and response sizes.
export const MAX_SHOWN_MOVIE_IDS = 500;
const MAX_GENRES = 10;
const MAX_GENRE_LENGTH = 50;
const MAX_RECENT_ITEMS = 50;
const MAX_RECENT_ITEM_LENGTH = 120;
const MAX_POSITION = 1000;
const MAX_METADATA_KEYS = 10;
const MAX_METADATA_KEY_LENGTH = 50;
const MAX_METADATA_STRING_LENGTH = 200;

const SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const MODES: readonly RecommendationMode[] = ['safe', 'discovery', 'balanced'];
const ERAS: readonly NonNullable<PickerFilters['era']>[] = [
	'1990+',
	'2000+',
	'2010+',
	'2020+',
	'classic',
	'all'
];
const ACTIONS: readonly PickerActionType[] = [
	'impression',
	'another',
	'not_tonight',
	'open',
	'watch',
	'favorite',
	'watchlist',
	'rating'
];

export interface RecommendRequest {
	sessionId: string;
	filters: PickerFilters;
	shownMovieIds: string[];
	position: number;
	recentDirectorsShown: string[];
	recentPrimaryGenresShown: string[];
}

function fail(error: string): { ok: false; error: string } {
	return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
	return (
		typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
	);
}

function parseStringList(
	value: unknown,
	name: string,
	maxItems: number,
	maxLength: number
): ParseResult<string[]> {
	if (value === undefined) return { ok: true, value: [] };
	if (!Array.isArray(value) || value.length > maxItems) {
		return fail(`${name} must be a list of at most ${maxItems} items.`);
	}

	const items: string[] = [];
	for (const item of value) {
		const text = typeof item === 'string' ? item.trim() : '';
		if (!text || text.length > maxLength) {
			return fail(`${name} must contain non-empty text of at most ${maxLength} characters.`);
		}
		items.push(text);
	}

	return { ok: true, value: items };
}

function parseFilters(value: unknown): ParseResult<PickerFilters> {
	if (value === undefined) return { ok: true, value: {} };
	if (!isRecord(value)) return fail('filters must be an object.');

	const explicit: PickerFilters = {};

	if (value.preset !== undefined) {
		if (typeof value.preset !== 'string' || !(value.preset in QUICK_PRESETS)) {
			return fail('filters.preset is not a supported preset.');
		}
		explicit.preset = value.preset as PickerPreset;
	}
	if (value.mode !== undefined) {
		if (!MODES.includes(value.mode as RecommendationMode)) return fail('filters.mode is invalid.');
		explicit.mode = value.mode as RecommendationMode;
	}
	if (value.era !== undefined) {
		if (!ERAS.includes(value.era as (typeof ERAS)[number])) return fail('filters.era is invalid.');
		explicit.era = value.era as (typeof ERAS)[number];
	}
	for (const key of ['minYear', 'maxYear'] as const) {
		if (value[key] === undefined) continue;
		if (!isIntegerInRange(value[key], 1880, 2100)) {
			return fail(`filters.${key} must be a year between 1880 and 2100.`);
		}
		explicit[key] = value[key];
	}
	if (value.minRating !== undefined) {
		const rating = value.minRating;
		if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0 || rating > 10) {
			return fail('filters.minRating must be a number between 0 and 10.');
		}
		explicit.minRating = rating;
	}
	if (value.minVotes !== undefined) {
		if (!isIntegerInRange(value.minVotes, 0, 10_000_000)) {
			return fail('filters.minVotes must be a whole number between 0 and 10000000.');
		}
		explicit.minVotes = value.minVotes;
	}
	if (value.maxRuntime !== undefined) {
		if (!isIntegerInRange(value.maxRuntime, 1, 600)) {
			return fail('filters.maxRuntime must be between 1 and 600 minutes.');
		}
		explicit.maxRuntime = value.maxRuntime;
	}
	for (const key of ['excludeWatched', 'excludeDisliked'] as const) {
		if (value[key] === undefined) continue;
		if (typeof value[key] !== 'boolean') return fail(`filters.${key} must be true or false.`);
		explicit[key] = value[key];
	}
	if (value.genres !== undefined) {
		const genres = parseStringList(value.genres, 'filters.genres', MAX_GENRES, MAX_GENRE_LENGTH);
		if (!genres.ok) return genres;
		explicit.genres = genres.value;
	}

	// A preset is only a starting point: explicitly supplied fields always win.
	const base = explicit.preset ? QUICK_PRESETS[explicit.preset] : {};
	return { ok: true, value: { ...base, ...explicit } };
}

export function parseRecommendRequest(body: unknown): ParseResult<RecommendRequest> {
	if (!isRecord(body)) return fail('Request body must be a JSON object.');

	let sessionId: string = crypto.randomUUID();
	if (body.sessionId !== undefined) {
		if (typeof body.sessionId !== 'string' || !SESSION_ID.test(body.sessionId)) {
			return fail('sessionId must be 1-64 letters, digits, dashes or underscores.');
		}
		sessionId = body.sessionId;
	}

	let position = 1;
	if (body.position !== undefined) {
		if (!isIntegerInRange(body.position, 1, MAX_POSITION)) {
			return fail(`position must be a whole number between 1 and ${MAX_POSITION}.`);
		}
		position = body.position;
	}

	const filters = parseFilters(body.filters);
	if (!filters.ok) return filters;

	const shownMovieIds = parseStringList(
		body.shownMovieIds,
		'shownMovieIds',
		MAX_SHOWN_MOVIE_IDS,
		36
	);
	if (!shownMovieIds.ok) return shownMovieIds;
	if (!shownMovieIds.value.every((id) => UUID.test(id))) {
		return fail('shownMovieIds must contain movie ids.');
	}

	const recentDirectorsShown = parseStringList(
		body.recentDirectorsShown,
		'recentDirectorsShown',
		MAX_RECENT_ITEMS,
		MAX_RECENT_ITEM_LENGTH
	);
	if (!recentDirectorsShown.ok) return recentDirectorsShown;

	const recentPrimaryGenresShown = parseStringList(
		body.recentPrimaryGenresShown,
		'recentPrimaryGenresShown',
		MAX_RECENT_ITEMS,
		MAX_RECENT_ITEM_LENGTH
	);
	if (!recentPrimaryGenresShown.ok) return recentPrimaryGenresShown;

	return {
		ok: true,
		value: {
			sessionId,
			filters: filters.value,
			shownMovieIds: shownMovieIds.value,
			position,
			recentDirectorsShown: recentDirectorsShown.value,
			recentPrimaryGenresShown: recentPrimaryGenresShown.value
		}
	};
}

function parseMetadata(
	value: unknown
): ParseResult<Record<string, string | number | boolean | null>> {
	if (!isRecord(value)) return fail('metadata must be an object.');

	const entries = Object.entries(value);
	if (entries.length > MAX_METADATA_KEYS) {
		return fail(`metadata may contain at most ${MAX_METADATA_KEYS} keys.`);
	}

	const metadata: Record<string, string | number | boolean | null> = {};
	for (const [key, item] of entries) {
		const isShortText = typeof item === 'string' && item.length <= MAX_METADATA_STRING_LENGTH;
		const isScalar =
			(typeof item === 'number' && Number.isFinite(item)) ||
			typeof item === 'boolean' ||
			item === null;
		if (key.length > MAX_METADATA_KEY_LENGTH || !(isShortText || isScalar)) {
			return fail('metadata values must be short text, numbers, booleans or null.');
		}
		metadata[key] = item as string | number | boolean | null;
	}

	return { ok: true, value: metadata };
}

export function parsePickerEvent(body: unknown): ParseResult<PickerEventPayload> {
	if (!isRecord(body)) return fail('Request body must be a JSON object.');

	if (typeof body.sessionId !== 'string' || !SESSION_ID.test(body.sessionId)) {
		return fail('sessionId must be 1-64 letters, digits, dashes or underscores.');
	}
	if (typeof body.movieId !== 'string' || !UUID.test(body.movieId)) {
		return fail('movieId must be a movie id.');
	}
	if (!ACTIONS.includes(body.action as PickerActionType)) {
		return fail('action is not a supported picker action.');
	}

	const event: PickerEventPayload = {
		sessionId: body.sessionId,
		movieId: body.movieId,
		action: body.action as PickerActionType
	};

	if (body.position !== undefined) {
		if (!isIntegerInRange(body.position, 1, MAX_POSITION)) {
			return fail(`position must be a whole number between 1 and ${MAX_POSITION}.`);
		}
		event.position = body.position;
	}
	if (body.score !== undefined) {
		if (typeof body.score !== 'number' || !Number.isFinite(body.score)) {
			return fail('score must be a finite number.');
		}
		event.score = body.score;
	}
	if (body.metadata !== undefined) {
		const metadata = parseMetadata(body.metadata);
		if (!metadata.ok) return metadata;
		event.metadata = metadata.value;
	}

	return { ok: true, value: event };
}
