import { describe, expect, it } from 'vitest';
import {
	MAX_RECENT_SEARCHES,
	RECENT_SEARCHES_KEY,
	clearRecentSearches,
	readRecentSearches,
	saveRecentSearch,
	type StorageLike
} from './recent-searches';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
	data: Map<string, string>;
} {
	const data = new Map(Object.entries(initial));
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

function throwingStorage(): StorageLike {
	const fail = () => {
		throw new DOMException('denied', 'SecurityError');
	};
	return { getItem: fail, setItem: fail, removeItem: fail };
}

describe('recent searches', () => {
	it('uses the documented key and cap', () => {
		expect(RECENT_SEARCHES_KEY).toBe('ui:recent-searches');
		expect(MAX_RECENT_SEARCHES).toBe(6);
	});

	it('starts empty', () => {
		expect(readRecentSearches(memoryStorage())).toEqual([]);
	});

	it('saves newest first and persists as JSON', () => {
		const storage = memoryStorage();
		saveRecentSearch('alien', storage);
		const result = saveRecentSearch('heat', storage);
		expect(result).toEqual(['heat', 'alien']);
		expect(JSON.parse(storage.data.get(RECENT_SEARCHES_KEY) as string)).toEqual(['heat', 'alien']);
		expect(readRecentSearches(storage)).toEqual(['heat', 'alien']);
	});

	it('trims and ignores blank queries', () => {
		const storage = memoryStorage();
		expect(saveRecentSearch('   ', storage)).toEqual([]);
		expect(saveRecentSearch('  heat  ', storage)).toEqual(['heat']);
		expect(storage.data.size).toBe(1);
	});

	it('dedupes case-insensitively and moves the repeat to the top, keeping the new spelling', () => {
		const storage = memoryStorage();
		saveRecentSearch('Alien', storage);
		saveRecentSearch('heat', storage);
		expect(saveRecentSearch('ALIEN', storage)).toEqual(['ALIEN', 'heat']);
	});

	it('keeps at most six, dropping the oldest', () => {
		const storage = memoryStorage();
		for (const query of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'])
			saveRecentSearch(query, storage);
		expect(readRecentSearches(storage)).toEqual(['g7', 'f6', 'e5', 'd4', 'c3', 'b2']);
	});

	it('ignores invalid JSON', () => {
		expect(readRecentSearches(memoryStorage({ [RECENT_SEARCHES_KEY]: '{nope' }))).toEqual([]);
	});

	it('ignores a stored value that is not an array', () => {
		expect(readRecentSearches(memoryStorage({ [RECENT_SEARCHES_KEY]: '{"a":1}' }))).toEqual([]);
	});

	it('drops non-string, blank and duplicate entries and caps what it reads', () => {
		const stored = JSON.stringify([
			'heat',
			3,
			null,
			'  ',
			'HEAT',
			'alien',
			{},
			'a1',
			'b2',
			'c3',
			'd4'
		]);
		expect(readRecentSearches(memoryStorage({ [RECENT_SEARCHES_KEY]: stored }))).toEqual([
			'heat',
			'alien',
			'a1',
			'b2',
			'c3',
			'd4'
		]);
	});

	it('recovers from corrupt storage on the next save', () => {
		const storage = memoryStorage({ [RECENT_SEARCHES_KEY]: 'garbage' });
		expect(saveRecentSearch('heat', storage)).toEqual(['heat']);
	});

	it('clears', () => {
		const storage = memoryStorage();
		saveRecentSearch('heat', storage);
		clearRecentSearches(storage);
		expect(readRecentSearches(storage)).toEqual([]);
		expect(storage.data.has(RECENT_SEARCHES_KEY)).toBe(false);
	});

	it('swallows quota and security errors', () => {
		const storage = throwingStorage();
		expect(readRecentSearches(storage)).toEqual([]);
		expect(() => saveRecentSearch('heat', storage)).not.toThrow();
		expect(saveRecentSearch('heat', storage)).toEqual(['heat']);
		expect(() => clearRecentSearches(storage)).not.toThrow();
	});

	it('is safe without any storage (server render)', () => {
		expect(readRecentSearches(null)).toEqual([]);
		expect(saveRecentSearch('heat', null)).toEqual(['heat']);
		expect(() => clearRecentSearches(null)).not.toThrow();
	});

	it('is safe when the default storage does not exist (node)', () => {
		expect(readRecentSearches()).toEqual([]);
		expect(() => saveRecentSearch('heat')).not.toThrow();
		expect(() => clearRecentSearches()).not.toThrow();
	});
});
