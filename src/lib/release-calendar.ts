import type { TMDBMovieSummary } from '../../worker/src/tmdb/client.js';

export const CALENDAR_RANGES = [7, 30, 90] as const;
export const RELEASE_TYPES = [
	'premiere',
	'theatrical_limited',
	'theatrical',
	'digital',
	'physical',
	'tv',
	'unknown'
] as const;
export const REMINDER_OFFSETS = [0, 1, 7] as const;
export const DEFAULT_CALENDAR_COUNTRY = 'FR';
export const DEFAULT_CALENDAR_TIMEZONE = 'Europe/Paris';

export type CalendarRange = (typeof CALENDAR_RANGES)[number];
export type ReleaseType = (typeof RELEASE_TYPES)[number];
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
	premiere: 'Premiere',
	theatrical_limited: 'Limited theatrical',
	theatrical: 'Theatrical',
	digital: 'Digital',
	physical: 'Physical',
	tv: 'TV',
	unknown: 'Unknown'
};

const TMDB_RELEASE_TYPES: Record<number, ReleaseType> = {
	1: 'premiere',
	2: 'theatrical_limited',
	3: 'theatrical',
	4: 'digital',
	5: 'physical',
	6: 'tv'
};

export function dateOnly(value: Date): string {
	return value.toISOString().slice(0, 10);
}

export function addUtcDays(date: string, days: number): string {
	const value = new Date(`${date}T00:00:00.000Z`);
	if (Number.isNaN(value.getTime())) throw new RangeError('Invalid calendar date.');
	value.setUTCDate(value.getUTCDate() + days);
	return dateOnly(value);
}

export function rollingCalendarWindow(now = new Date()): { startDate: string; endDate: string } {
	const startDate = dateOnly(now);
	return { startDate, endDate: addUtcDays(startDate, 89) };
}

export function releaseTypeFromTmdb(value: number): ReleaseType {
	return TMDB_RELEASE_TYPES[value] ?? 'unknown';
}

export function normalizeCountryCode(value: unknown): string {
	const country = typeof value === 'string' ? value.trim().toUpperCase() : '';
	return /^[A-Z]{2}$/u.test(country) ? country : DEFAULT_CALENDAR_COUNTRY;
}

export function normalizeTimezone(value: unknown): string {
	if (typeof value !== 'string' || value.length > 64) return DEFAULT_CALENDAR_TIMEZONE;
	try {
		new Intl.DateTimeFormat('en', { timeZone: value }).format();
		return value;
	} catch {
		return DEFAULT_CALENDAR_TIMEZONE;
	}
}

export function parseCalendarRange(value: unknown): CalendarRange {
	const parsed = Number(value);
	return CALENDAR_RANGES.includes(parsed as CalendarRange) ? (parsed as CalendarRange) : 30;
}

export function parseReleaseType(value: unknown): ReleaseType | null {
	return typeof value === 'string' && RELEASE_TYPES.includes(value as ReleaseType)
		? (value as ReleaseType)
		: null;
}

export function sortAndLimitDiscovery(
	movies: Iterable<TMDBMovieSummary>,
	limit = 100
): TMDBMovieSummary[] {
	const unique = new Map<number, TMDBMovieSummary>();
	for (const movie of movies) {
		if (!unique.has(movie.id)) unique.set(movie.id, movie);
	}
	return [...unique.values()]
		.sort(
			(left, right) =>
				right.popularity - left.popularity ||
				(left.release_date || '9999-12-31').localeCompare(right.release_date || '9999-12-31') ||
				left.id - right.id
		)
		.slice(0, Math.max(0, Math.min(limit, 100)));
}

export function reminderDueDate(releaseDate: string, offsetDays: ReminderOffset): string {
	return addUtcDays(releaseDate, -offsetDays);
}

function escapeIcs(value: string): string {
	return value
		.replaceAll('\\', '\\\\')
		.replaceAll('\n', '\\n')
		.replaceAll(',', '\\,')
		.replaceAll(';', '\\;');
}

function compactDate(value: string): string {
	return value.replaceAll('-', '');
}

export function createReleaseReminderIcs(input: {
	id: string;
	title: string;
	releaseDate: string;
	offsetDays: ReminderOffset;
	timezone: string;
	movieUrl: string;
	now?: Date;
}): string {
	const dueDate = reminderDueDate(input.releaseDate, input.offsetDays);
	const endDate = addUtcDays(dueDate, 1);
	const description =
		input.offsetDays === 0
			? `${input.title} releases today.`
			: `${input.title} releases in ${input.offsetDays} day${input.offsetDays === 1 ? '' : 's'}.`;
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Alan Database//Release Calendar//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${escapeIcs(input.id)}@alandatabase.com`,
		`DTSTAMP:${(input.now ?? new Date())
			.toISOString()
			.replaceAll('-', '')
			.replaceAll(':', '')
			.replace(/\.\d{3}Z$/u, 'Z')}`,
		`DTSTART;VALUE=DATE:${compactDate(dueDate)}`,
		`DTEND;VALUE=DATE:${compactDate(endDate)}`,
		`SUMMARY:${escapeIcs(input.title)}`,
		`DESCRIPTION:${escapeIcs(description)} Timezone: ${escapeIcs(input.timezone)}`,
		`URL:${escapeIcs(input.movieUrl)}`,
		'END:VEVENT',
		'END:VCALENDAR'
	];
	return `${lines.join('\r\n')}\r\n`;
}
