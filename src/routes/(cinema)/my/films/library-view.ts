// Pure view helpers for the Library page (Stats and the section tabs).

export interface WatchTime {
	hours: number;
	minutes: number;
	/** "20 h 12 min", "2 h", "45 min". */
	label: string;
}

export function watchTime(totalMinutes: number): WatchTime {
	const total = Number.isFinite(totalMinutes) ? Math.max(0, Math.round(totalMinutes)) : 0;
	const hours = Math.floor(total / 60);
	const minutes = total % 60;
	const label =
		hours === 0 ? `${minutes} min` : minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
	return { hours, minutes, label };
}

/** One decade is a sentence, not a chart; several decades return null (show the chart). */
export function decadeSentence(decades: Array<{ decade: number; count: number }>): string | null {
	if (decades.length !== 1) return null;
	const [{ decade, count }] = decades;
	return count === 1
		? `Your one film is from the ${decade}s.`
		: `All ${count} films are from the ${decade}s.`;
}

/** Which ends of a horizontal scroller still hide content (for the edge fades). */
export function scrollEdges(
	scrollLeft: number,
	scrollWidth: number,
	clientWidth: number
): { start: boolean; end: boolean } {
	const room = scrollWidth - clientWidth;
	if (room <= 1) return { start: false, end: false };
	return { start: scrollLeft > 1, end: scrollLeft < room - 1 };
}
