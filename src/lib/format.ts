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

// The country whose flag stands for a film's original language. Languages spoken across many
// countries without one obvious home (Latin, Esperanto...) get a name but no flag.
const LANGUAGE_REGIONS: Record<string, string> = {
	en: 'GB',
	fr: 'FR',
	es: 'ES',
	de: 'DE',
	it: 'IT',
	pt: 'PT',
	ja: 'JP',
	ko: 'KR',
	zh: 'CN',
	cn: 'HK',
	hi: 'IN',
	ta: 'IN',
	te: 'IN',
	ml: 'IN',
	bn: 'BD',
	ru: 'RU',
	uk: 'UA',
	pl: 'PL',
	cs: 'CZ',
	sk: 'SK',
	hu: 'HU',
	ro: 'RO',
	bg: 'BG',
	el: 'GR',
	tr: 'TR',
	ar: 'SA',
	he: 'IL',
	fa: 'IR',
	th: 'TH',
	vi: 'VN',
	id: 'ID',
	ms: 'MY',
	tl: 'PH',
	nl: 'NL',
	sv: 'SE',
	da: 'DK',
	no: 'NO',
	nb: 'NO',
	fi: 'FI',
	is: 'IS',
	et: 'EE',
	lv: 'LV',
	lt: 'LT',
	sr: 'RS',
	hr: 'HR',
	sl: 'SI',
	ga: 'IE',
	cy: 'GB',
	ka: 'GE',
	hy: 'AM',
	kk: 'KZ',
	ur: 'PK',
	sw: 'KE',
	af: 'ZA'
};

function regionFlag(region: string): string {
	return String.fromCodePoint(...[...region].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

/** ISO 639-1 code ("en") to a readable English name and, when one country fits, its flag. */
export function formatLanguage(code: unknown): { name: string; flag: string | null } | null {
	if (typeof code !== 'string' || !/^[a-z]{2}$/iu.test(code.trim())) return null;
	const iso = code.trim().toLowerCase();
	let name = iso.toUpperCase();
	try {
		name = new Intl.DisplayNames(['en'], { type: 'language' }).of(iso) ?? name;
	} catch {
		// Older runtimes without DisplayNames keep the code.
	}
	const region = LANGUAGE_REGIONS[iso];
	return { name, flag: region ? regionFlag(region) : null };
}
