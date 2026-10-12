function toNumber(value: unknown): number | null {
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function formatRuntime(minutes: unknown): string | null {
	const total = toNumber(minutes);
	if (total === null || total <= 0) return null;
	const whole = Math.round(total);
	const hours = Math.floor(whole / 60);
	const rest = whole % 60;
	if (hours === 0) return `${rest}m`;
	return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatYear(date: unknown): string | null {
	if (typeof date !== 'string') return null;
	const match = /^(\d{4})/u.exec(date.trim());
	return match ? match[1] : null;
}

export function formatRating(value: unknown): string | null {
	const rating = toNumber(value);
	if (rating === null || rating <= 0) return null;
	return rating.toFixed(1);
}

function compact(value: number, suffixes: Array<[number, string]>): string {
	for (const [threshold, suffix] of suffixes) {
		if (value >= threshold) {
			const scaled = value / threshold;
			const text =
				scaled >= 10 ? Math.round(scaled).toString() : scaled.toFixed(1).replace(/\.0$/u, '');
			return `${text}${suffix}`;
		}
	}
	return Math.round(value).toString();
}

export function formatVotes(count: unknown): string | null {
	const votes = toNumber(count);
	if (votes === null || votes <= 0) return null;
	return compact(votes, [
		[1_000_000, 'M'],
		[1_000, 'K']
	]);
}

export function formatMoney(amount: unknown): string | null {
	const money = toNumber(amount);
	if (money === null || money <= 0) return null;
	return `$${compact(money, [
		[1_000_000_000, 'B'],
		[1_000_000, 'M'],
		[1_000, 'K']
	])}`;
}

const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});

export function formatDate(date: unknown): string | null {
	if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}/u.test(date)) return null;
	const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
	return Number.isNaN(parsed.getTime()) ? null : LONG_DATE.format(parsed);
}
