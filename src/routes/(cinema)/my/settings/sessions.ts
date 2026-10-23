// Pure helpers for the Settings sessions list.

export interface SessionRow {
	isCurrent: boolean;
	createdAt: string;
	expiresAt: string;
}

export interface GroupedSessions<T extends SessionRow> {
	current: T | null;
	/** The newest other sessions, shown straight away. */
	visible: T[];
	/** The rest, behind a "Show all" disclosure. */
	hidden: T[];
	otherCount: number;
}

const newestFirst = (a: SessionRow, b: SessionRow) =>
	Date.parse(b.createdAt) - Date.parse(a.createdAt);

export function groupSessions<T extends SessionRow>(
	sessions: T[],
	visibleOthers = 3
): GroupedSessions<T> {
	const current = sessions.find((session) => session.isCurrent) ?? null;
	const others = sessions.filter((session) => !session.isCurrent).sort(newestFirst);
	return {
		current,
		visible: others.slice(0, visibleOthers),
		hidden: others.slice(visibleOthers),
		otherCount: others.length
	};
}

const formatter = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZone: 'UTC'
});

/** A fixed locale and time zone, so the server and the browser print the same text. */
export function formatSessionDate(iso: string): string {
	const time = Date.parse(iso);
	if (Number.isNaN(time)) return 'Unknown date';
	return `${formatter.format(new Date(time))} UTC`;
}
