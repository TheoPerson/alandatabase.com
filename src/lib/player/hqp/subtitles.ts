// Subtitle policy and cue parsing. Cues become plain text spans (italic/bold only): the UI renders
// them as text nodes, never as HTML.
import type { HqpCueSpan, HqpPrefs, HqpSubtitleOption } from './types';

// ISO 639-1 and 639-2/T codes mapped to the 639-2/B code used by the library tags.
const ALIASES: Record<string, string> = {
	fr: 'fre',
	fra: 'fre',
	en: 'eng',
	de: 'ger',
	deu: 'ger',
	es: 'spa',
	it: 'ita',
	pt: 'por',
	ja: 'jpn',
	ko: 'kor',
	zh: 'chi',
	zho: 'chi',
	ru: 'rus',
	nl: 'dut',
	nld: 'dut',
	ar: 'ara',
	pl: 'pol',
	sv: 'swe',
	da: 'dan',
	no: 'nor',
	fi: 'fin',
	tr: 'tur',
	el: 'gre',
	ell: 'gre',
	he: 'heb',
	hi: 'hin',
	cs: 'cze',
	ces: 'cze',
	hu: 'hun',
	ro: 'rum',
	ron: 'rum',
	uk: 'ukr'
};
const BCP47: Record<string, string> = Object.fromEntries(
	Object.entries(ALIASES)
		.filter(([k]) => k.length === 2)
		.map(([k, v]) => [v, k])
);
const UNKNOWN = new Set(['und', 'mul', 'zxx', 'mis']);

/** Comparable language key ('fra', 'fr' and 'fre' are all 'fre'); null when unknown. */
export function languageKey(code: string | null | undefined): string | null {
	const c = (code ?? '').trim().toLowerCase();
	if (!/^[a-z]{2,3}$/.test(c) || UNKNOWN.has(c)) return null;
	return ALIASES[c] ?? c;
}

/** A `srclang` value for a <track> element. */
export function toBcp47(code: string | null | undefined): string {
	const key = languageKey(code);
	return key ? (BCP47[key] ?? key) : 'und';
}

export function isSdh(title: string | null | undefined): boolean {
	return !!title && /sdh|\bcc\b|sourds|malentendants|hearing/i.test(title);
}

/**
 * auto: audio in the subtitle language -> its forced track only; other audio -> the full track.
 * off: forced lines for the audio language stay. on: the full track. Image tracks never.
 */
export function chooseSubtitles(
	options: HqpSubtitleOption[],
	audioLanguage: string | null,
	prefs: Pick<HqpPrefs, 'subtitleMode' | 'subtitleLanguage'>
): { selected: number | null; forced: number | null } {
	const text = options.filter((o) => o.isText && !!o.url);
	const wanted = languageKey(prefs.subtitleLanguage);
	const audio = languageKey(audioLanguage);
	const inLang = (l: string | null) => text.filter((o) => languageKey(o.language) === l);
	const full = (list: HqpSubtitleOption[]) =>
		(list.find((o) => !o.forced && !o.sdh) ?? list.find((o) => !o.forced))?.ordinal ?? null;
	const forcedFor = (l: string | null) => inLang(l).find((o) => o.forced)?.ordinal ?? null;

	if (prefs.subtitleMode === 'on') {
		return { selected: full(inLang(wanted)) ?? full(text), forced: null };
	}
	if (prefs.subtitleMode === 'off') return { selected: null, forced: forcedFor(audio ?? wanted) };
	if (audio !== null && audio === wanted) return { selected: null, forced: forcedFor(wanted) };
	return { selected: full(inLang(wanted)), forced: null };
}

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	nbsp: ' ',
	quot: '"',
	apos: "'",
	lrm: '‎',
	rlm: '‏'
};

function decode(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
		if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
		const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
		return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
	});
}

/** WebVTT cue text to lines of spans: <i> and <b> kept, every other tag and ASS block dropped. */
export function cueToSpans(text: string): HqpCueSpan[][] {
	let italic = false;
	let bold = false;
	const lines: HqpCueSpan[][] = [];
	for (const raw of text.replace(/\{\\[^}]*\}/g, '').split(/\r?\n/)) {
		const line: HqpCueSpan[] = [];
		for (const part of raw.split(/(<[^>]*>)/)) {
			const tag = /^<(\/?)([a-z]+)/i.exec(part);
			if (part.startsWith('<') && part.endsWith('>')) {
				const name = tag?.[2].toLowerCase();
				if (name === 'i') italic = !tag?.[1];
				if (name === 'b') bold = !tag?.[1];
				continue;
			}
			const value = decode(part);
			if (!value) continue;
			const prev = line.at(-1);
			if (prev && prev.italic === italic && prev.bold === bold) prev.text += value;
			else line.push({ text: value, italic, bold });
		}
		if (line.some((s) => s.text.trim())) lines.push(line);
	}
	return lines;
}
