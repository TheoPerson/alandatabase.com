import { describe, expect, it } from 'vitest';
import {
	addUtcDays,
	createReleaseReminderIcs,
	normalizeCountryCode,
	normalizeTimezone,
	releaseTypeFromTmdb,
	reminderDueDate,
	rollingCalendarWindow,
	sortAndLimitDiscovery
} from './release-calendar';
import type { TMDBMovieSummary } from '../../worker/src/tmdb/client.js';

function movie(id: number, popularity: number, releaseDate: string): TMDBMovieSummary {
	return {
		id,
		title: `Movie ${id}`,
		original_title: `Movie ${id}`,
		original_language: 'en',
		overview: 'Overview',
		poster_path: null,
		backdrop_path: null,
		release_date: releaseDate,
		genre_ids: [],
		popularity,
		vote_average: 0,
		vote_count: 0,
		adult: false
	};
}

describe('release calendar domain rules', () => {
	it('uses an inclusive rolling 90-day UTC window across year boundaries', () => {
		expect(rollingCalendarWindow(new Date('2026-12-15T23:59:59Z'))).toEqual({
			startDate: '2026-12-15',
			endDate: '2027-03-14'
		});
		expect(addUtcDays('2028-02-28', 1)).toBe('2028-02-29');
	});

	it('deduplicates and sorts by popularity, date, then TMDB id', () => {
		const result = sortAndLimitDiscovery([
			movie(4, 10, '2026-10-04'),
			movie(2, 20, '2026-10-03'),
			movie(3, 20, '2026-10-03'),
			movie(2, 99, '2026-10-01'),
			movie(1, 20, '')
		]);
		expect(result.map(({ id }) => id)).toEqual([2, 3, 1, 4]);
		expect(
			sortAndLimitDiscovery(
				Array.from({ length: 105 }, (_, index) => movie(index + 1, 105 - index, '2026-10-01'))
			)
		).toHaveLength(100);
	});

	it('uses unknown for unsupported release types instead of inventing one', () => {
		expect(releaseTypeFromTmdb(3)).toBe('theatrical');
		expect(releaseTypeFromTmdb(99)).toBe('unknown');
	});

	it('normalizes countries and timezones with the documented fallbacks', () => {
		expect(normalizeCountryCode('us')).toBe('US');
		expect(normalizeCountryCode('France')).toBe('FR');
		expect(normalizeTimezone('America/New_York')).toBe('America/New_York');
		expect(normalizeTimezone('Mars/Olympus')).toBe('Europe/Paris');
	});

	it('calculates reminder dates and exports a valid all-day calendar event', () => {
		expect(reminderDueDate('2026-09-08', 7)).toBe('2026-09-01');
		const ics = createReleaseReminderIcs({
			id: 'reminder-1',
			title: 'Film, The Return',
			releaseDate: '2026-09-08',
			offsetDays: 7,
			timezone: 'Europe/Paris',
			movieUrl: 'https://example.test/movies/1',
			now: new Date('2026-09-01T12:30:00Z')
		});
		expect(ics).toContain('BEGIN:VCALENDAR\r\n');
		expect(ics).toContain('DTSTART;VALUE=DATE:20260901');
		expect(ics).toContain('DTEND;VALUE=DATE:20260902');
		expect(ics).toContain('SUMMARY:Film\\, The Return');
		expect(ics.endsWith('\r\n')).toBe(true);
	});
});
