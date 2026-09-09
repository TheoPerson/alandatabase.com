import type { TMDBTVDetail, TMDBTVEpisode } from '../../worker/src/tmdb/client.js';

export const TV_NOTIFICATION_OFFSETS = [0, 1, 7] as const;
export const DEFAULT_NOTIFICATION_PROFILE = 'default';
export const DEFAULT_NOTIFICATION_TIMEZONE = 'Europe/Paris';
export const NOTIFICATION_USER_TYPE = 'account';

export type TVNotificationOffset = (typeof TV_NOTIFICATION_OFFSETS)[number];

export function normalizeNotificationOffset(value: unknown): TVNotificationOffset {
	const offset = Number(value);
	return TV_NOTIFICATION_OFFSETS.includes(offset as TVNotificationOffset)
		? (offset as TVNotificationOffset)
		: 0;
}

export function normalizeNotificationTimezone(value: unknown): string {
	if (typeof value !== 'string' || value.length > 64) return DEFAULT_NOTIFICATION_TIMEZONE;
	try {
		new Intl.DateTimeFormat('en', { timeZone: value }).format();
		return value;
	} catch {
		return DEFAULT_NOTIFICATION_TIMEZONE;
	}
}

export function todayInTimezone(now: Date, timezone: string): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: normalizeNotificationTimezone(timezone),
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

export function shiftDate(date: string, days: number): string {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new RangeError('Invalid episode air date.');
	const value = new Date(`${date}T00:00:00.000Z`);
	if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
		throw new RangeError('Invalid episode air date.');
	}
	if (!Number.isSafeInteger(days)) throw new RangeError('Invalid date offset.');
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
}

export function episodeNotificationDueDate(
	airDate: string,
	offsetDays: TVNotificationOffset
): string {
	return shiftDate(airDate, -offsetDays);
}

export function isEpisodeNotificationDue(input: {
	airDate: string;
	offsetDays: TVNotificationOffset;
	timezone: string;
	now: Date;
}): boolean {
	const today = todayInTimezone(input.now, input.timezone);
	const dueDate = episodeNotificationDueDate(input.airDate, input.offsetDays);
	return dueDate <= today && input.airDate >= shiftDate(today, -1);
}

export function relevantTVSeasonNumbers(
	show: TMDBTVDetail,
	today = new Date().toISOString().slice(0, 10)
): number[] {
	const yesterday = shiftDate(today, -1);
	const upcoming = show.seasons
		.filter((season) => season.air_date && season.air_date >= yesterday)
		.sort(
			(left, right) =>
				(left.air_date ?? '').localeCompare(right.air_date ?? '') ||
				left.season_number - right.season_number
		);
	// This is a bounded metadata poll, not an exhaustive scan of a show's archive.
	const candidates = [
		show.next_episode_to_air?.season_number,
		show.last_episode_to_air?.season_number,
		...upcoming.map((season) => season.season_number),
		...show.seasons
			.filter((season) => season.season_number > 0)
			.sort((left, right) => right.season_number - left.season_number)
			.map((season) => season.season_number)
	].filter((value): value is number => Number.isSafeInteger(value) && Number(value) >= 0);
	return [...new Set(candidates)].slice(0, 3);
}

export function episodeNotificationCopy(
	showTitle: string,
	episode: Pick<TMDBTVEpisode, 'name' | 'season_number' | 'episode_number' | 'air_date'>,
	timezone: string,
	now: Date
): { title: string; body: string } {
	if (!episode.air_date) throw new RangeError('A known episode air date is required.');
	shiftDate(episode.air_date, 0);
	const today = todayInTimezone(now, timezone);
	const daysUntil = Math.round(
		(new Date(`${episode.air_date}T00:00:00.000Z`).getTime() -
			new Date(`${today}T00:00:00.000Z`).getTime()) /
			86_400_000
	);
	const timing =
		daysUntil < 0
			? `aired on ${episode.air_date}`
			: daysUntil === 0
				? 'airs today'
				: daysUntil === 1
					? 'airs tomorrow'
					: `airs in ${daysUntil} days`;
	return {
		title: `New ${showTitle} episode`,
		body: `S${episode.season_number} E${episode.episode_number}, ${episode.name}, ${timing}.`
	};
}
