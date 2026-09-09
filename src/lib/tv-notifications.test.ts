import { describe, expect, it } from 'vitest';
import type { TMDBTVDetail } from '../../worker/src/tmdb/client';
import {
	episodeNotificationCopy,
	episodeNotificationDueDate,
	isEpisodeNotificationDue,
	normalizeNotificationOffset,
	normalizeNotificationTimezone,
	relevantTVSeasonNumbers,
	shiftDate,
	todayInTimezone
} from './tv-notifications';

describe('TV episode notification rules', () => {
	it('normalizes supported timing and calculates all-day due dates', () => {
		expect(normalizeNotificationOffset('7')).toBe(7);
		expect(normalizeNotificationOffset('3')).toBe(0);
		expect(episodeNotificationDueDate('2026-09-08', 7)).toBe('2026-09-01');
	});

	it('uses the account timezone at a UTC date boundary', () => {
		const now = new Date('2026-09-01T22:30:00.000Z');
		expect(todayInTimezone(now, 'Europe/Paris')).toBe('2026-09-02');
		expect(todayInTimezone(now, 'America/New_York')).toBe('2026-09-01');
	});

	it('delivers upcoming alerts once due and allows a one-day late recovery', () => {
		const now = new Date('2026-09-08T08:00:00.000Z');
		expect(
			isEpisodeNotificationDue({
				airDate: '2026-09-09',
				offsetDays: 7,
				timezone: 'Europe/Paris',
				now
			})
		).toBe(true);
		expect(
			isEpisodeNotificationDue({
				airDate: '2026-09-06',
				offsetDays: 0,
				timezone: 'Europe/Paris',
				now
			})
		).toBe(false);
	});

	it('bounds metadata checks and prioritizes upcoming dated seasons before an archive fallback', () => {
		const show = {
			next_episode_to_air: { season_number: 4 },
			last_episode_to_air: { season_number: 3 },
			seasons: [
				{ season_number: 9, air_date: null },
				{ season_number: 5, air_date: '2026-09-10' },
				{ season_number: 4, air_date: '2026-08-10' },
				{ season_number: 3, air_date: '2025-09-10' }
			]
		} as unknown as TMDBTVDetail;
		expect(relevantTVSeasonNumbers(show, '2026-09-01')).toEqual([4, 3, 5]);
	});

	it('deduplicates seasons and includes a dated upcoming special when next episode is absent', () => {
		const show = {
			next_episode_to_air: null,
			last_episode_to_air: { season_number: 3 },
			seasons: [
				{ season_number: 0, air_date: '2026-09-05' },
				{ season_number: 4, air_date: '2026-10-01' },
				{ season_number: 3, air_date: '2025-09-10' }
			]
		} as unknown as TMDBTVDetail;
		expect(relevantTVSeasonNumbers(show, '2026-09-01')).toEqual([3, 0, 4]);
	});

	it('rejects impossible calendar dates and handles leap years', () => {
		for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '', '2026-9-01']) {
			expect(() => shiftDate(date, 0)).toThrow('Invalid episode air date');
		}
		expect(shiftDate('2028-02-29', 1)).toBe('2028-03-01');
		expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
		expect(() => shiftDate('2026-09-01', 0.5)).toThrow('Invalid date offset');
	});

	it('uses calendar days across daylight saving transitions and normalizes invalid zones', () => {
		expect(normalizeNotificationTimezone('Mars/Olympus')).toBe('Europe/Paris');
		expect(todayInTimezone(new Date('2026-03-29T22:30:00Z'), 'Europe/Paris')).toBe('2026-03-30');
		expect(todayInTimezone(new Date('2026-10-25T23:30:00Z'), 'Europe/Paris')).toBe('2026-10-26');
		expect(episodeNotificationDueDate('2026-03-30', 1)).toBe('2026-03-29');
		expect(episodeNotificationDueDate('2026-10-26', 1)).toBe('2026-10-25');
	});

	it('does not deliver before the reminder date or recover episodes older than yesterday', () => {
		const input = {
			offsetDays: 1 as const,
			timezone: 'Europe/Paris',
			now: new Date('2026-09-08T08:00:00Z')
		};
		expect(isEpisodeNotificationDue({ ...input, airDate: '2026-09-10' })).toBe(false);
		expect(isEpisodeNotificationDue({ ...input, airDate: '2026-09-09' })).toBe(true);
		expect(isEpisodeNotificationDue({ ...input, airDate: '2026-09-07' })).toBe(true);
		expect(isEpisodeNotificationDue({ ...input, airDate: '2026-09-06' })).toBe(false);
	});

	it('creates honest episode copy with a stable series target', () => {
		expect(
			episodeNotificationCopy(
				'The Bear',
				{ name: 'Tomorrow', season_number: 5, episode_number: 2, air_date: '2026-09-09' },
				'Europe/Paris',
				new Date('2026-09-08T08:00:00.000Z')
			)
		).toEqual({
			title: 'New The Bear episode',
			body: 'S5 E2, Tomorrow, airs tomorrow.'
		});
	});

	it('describes air dates without claiming streaming availability or calling a late alert today', () => {
		const episode = {
			name: 'Episode',
			season_number: 1,
			episode_number: 1,
			air_date: '2026-09-08'
		};
		const now = new Date('2026-09-08T08:00:00Z');
		expect(episodeNotificationCopy('Show', episode, 'Europe/Paris', now).body).toContain(
			'airs today'
		);
		expect(
			episodeNotificationCopy('Show', { ...episode, air_date: '2026-09-07' }, 'Europe/Paris', now)
				.body
		).toContain('aired on 2026-09-07');
		expect(() =>
			episodeNotificationCopy('Show', { ...episode, air_date: null }, 'Europe/Paris', now)
		).toThrow('known episode air date');
	});
});
