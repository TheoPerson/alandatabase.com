function parts(seconds: number): { h: number; m: number; s: number } {
	const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
	return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

/** Clock form: 0:00, 1:15, 1:02:05. */
export function formatTime(seconds: number): string {
	const { h, m, s } = parts(seconds);
	const minutes = h > 0 ? String(m).padStart(2, '0') : String(m);
	return `${h > 0 ? `${h}:` : ''}${minutes}:${String(s).padStart(2, '0')}`;
}

/** Spoken form for assistive technology: "1 minute 15 seconds". */
export function spokenTime(seconds: number): string {
	const { h, m, s } = parts(seconds);
	const words: string[] = [];
	if (h) words.push(`${h} hour${h === 1 ? '' : 's'}`);
	if (m) words.push(`${m} minute${m === 1 ? '' : 's'}`);
	if (s || words.length === 0) words.push(`${s} second${s === 1 ? '' : 's'}`);
	return words.join(' ');
}
