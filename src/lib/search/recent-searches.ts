import { normalizeQuery } from './query';

// The last few searches live in this browser only; nothing here reaches the server.
export const RECENT_SEARCHES_KEY = 'ui:recent-searches';
export const MAX_RECENT_SEARCHES = 6;

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

// Reading the property can itself throw (blocked site data), and there is no
// storage at all while rendering on the server (newer Node versions even warn
// when the global is touched, so check for a window first).
function browserStorage(): StorageLike | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage ?? null;
	} catch {
		return null;
	}
}

function resolve(storage: StorageLike | null | undefined): StorageLike | null {
	return storage === undefined ? browserStorage() : storage;
}

function clean(entries: unknown[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const entry of entries) {
		const query = normalizeQuery(entry);
		const key = query.toLowerCase();
		if (!query || seen.has(key)) continue;
		seen.add(key);
		result.push(query);
		if (result.length === MAX_RECENT_SEARCHES) break;
	}
	return result;
}

export function readRecentSearches(storage?: StorageLike | null): string[] {
	const target = resolve(storage);
	if (!target) return [];
	try {
		const parsed: unknown = JSON.parse(target.getItem(RECENT_SEARCHES_KEY) ?? '[]');
		return Array.isArray(parsed) ? clean(parsed) : [];
	} catch {
		return [];
	}
}

/** Newest first. Returns the list as it now stands, even when persisting fails. */
export function saveRecentSearch(value: unknown, storage?: StorageLike | null): string[] {
	const query = normalizeQuery(value);
	const current = readRecentSearches(storage);
	if (!query) return current;
	const next = clean([query, ...current]);
	try {
		resolve(storage)?.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
	} catch {
		// Quota or privacy mode: recent searches are a convenience, never an error.
	}
	return next;
}

export function clearRecentSearches(storage?: StorageLike | null): void {
	try {
		resolve(storage)?.removeItem(RECENT_SEARCHES_KEY);
	} catch {
		// Same as above.
	}
}
