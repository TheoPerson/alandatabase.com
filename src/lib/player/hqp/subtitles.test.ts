import { describe, expect, it } from 'vitest';
import { chooseSubtitles, cueToSpans, isSdh, languageKey, toBcp47 } from './subtitles';
import type { HqpSubtitleOption } from './types';

const opt = (
	ordinal: number,
	language: string | null,
	over: Partial<HqpSubtitleOption> = {}
): HqpSubtitleOption => ({
	ordinal,
	label: `Track ${ordinal}`,
	language,
	title: null,
	forced: false,
	sdh: false,
	isText: true,
	url: `/api/media/files/f/subtitles/${ordinal}.vtt`,
	...over
});

const options = [
	opt(0, 'fre', { forced: true }),
	opt(1, 'fre', { sdh: true }),
	opt(2, 'fre'),
	opt(3, 'eng'),
	opt(4, 'fre', { isText: false, url: null })
];

describe('chooseSubtitles', () => {
	const prefs = (subtitleMode: 'auto' | 'on' | 'off', subtitleLanguage = 'fre') => ({
		subtitleMode,
		subtitleLanguage
	});

	it('auto: French audio keeps only the forced French track', () => {
		expect(chooseSubtitles(options, 'fre', prefs('auto'))).toEqual({ selected: null, forced: 0 });
		expect(chooseSubtitles(options, 'fra', prefs('auto'))).toEqual({ selected: null, forced: 0 });
	});

	it('auto: English audio shows the full French track (not SDH, not forced)', () => {
		expect(chooseSubtitles(options, 'eng', prefs('auto'))).toEqual({ selected: 2, forced: null });
		expect(chooseSubtitles(options, null, prefs('auto'))).toEqual({ selected: 2, forced: null });
	});

	it('off keeps a forced track; on selects the full track', () => {
		expect(chooseSubtitles(options, 'fre', prefs('off'))).toEqual({ selected: null, forced: 0 });
		expect(chooseSubtitles(options, 'eng', prefs('off'))).toEqual({ selected: null, forced: null });
		expect(chooseSubtitles(options, 'fre', prefs('on'))).toEqual({ selected: 2, forced: null });
		expect(chooseSubtitles(options, 'fre', prefs('on', 'eng'))).toEqual({
			selected: 3,
			forced: null
		});
	});

	it('falls back to SDH, then to any text track for "on", and never picks image tracks', () => {
		const sdhOnly = [opt(1, 'fre', { sdh: true }), opt(4, 'fre', { isText: false, url: null })];
		expect(chooseSubtitles(sdhOnly, 'eng', prefs('auto'))).toEqual({ selected: 1, forced: null });
		const imageOnly = [opt(4, 'fre', { isText: false, url: null })];
		expect(chooseSubtitles(imageOnly, 'eng', prefs('on'))).toEqual({
			selected: null,
			forced: null
		});
		expect(chooseSubtitles([opt(3, 'eng')], 'fre', prefs('on'))).toEqual({
			selected: 3,
			forced: null
		});
		expect(chooseSubtitles([opt(3, 'eng')], 'eng', prefs('auto'))).toEqual({
			selected: null,
			forced: null
		});
	});
});

describe('language helpers', () => {
	it('normalizes ISO 639-1 and 639-2 B/T codes', () => {
		expect(languageKey('fra')).toBe('fre');
		expect(languageKey('fr')).toBe('fre');
		expect(languageKey('FRE')).toBe('fre');
		expect(languageKey('en')).toBe('eng');
		expect(languageKey('deu')).toBe('ger');
		expect(languageKey('und')).toBeNull();
		expect(languageKey(null)).toBeNull();
		expect(toBcp47('fre')).toBe('fr');
		expect(toBcp47('eng')).toBe('en');
		expect(toBcp47('xyz')).toBe('xyz');
		expect(toBcp47(null)).toBe('und');
	});

	it('detects SDH titles', () => {
		expect(isSdh('Français SDH')).toBe(true);
		expect(isSdh('English CC')).toBe(true);
		expect(isSdh('Sourds et malentendants')).toBe(true);
		expect(isSdh('Hearing impaired')).toBe(true);
		expect(isSdh('Français')).toBe(false);
		expect(isSdh(null)).toBe(false);
	});
});

describe('cueToSpans', () => {
	it('keeps italic and bold, splits lines', () => {
		expect(cueToSpans('Hello <i>world</i>\n<b>Bold</b> end')).toEqual([
			[
				{ text: 'Hello ', italic: false, bold: false },
				{ text: 'world', italic: true, bold: false }
			],
			[
				{ text: 'Bold', italic: false, bold: true },
				{ text: ' end', italic: false, bold: false }
			]
		]);
	});

	it('drops every other tag and decodes entities, never producing markup', () => {
		const spans = cueToSpans(
			'<v Joyce><c.yellow>Will?</c></v> <u>x</u> <00:01:02.000>&lt;b&gt; &amp; &nbsp;&#233;&#x41;'
		);
		expect(spans).toEqual([[{ text: 'Will? x <b> &  éA', italic: false, bold: false }]]);
		expect(cueToSpans('<script>alert(1)</script>')).toEqual([
			[{ text: 'alert(1)', italic: false, bold: false }]
		]);
	});

	it('strips ASS override blocks and empty lines, handles nesting and unclosed tags', () => {
		expect(cueToSpans('{\\an8}<i>Top <b>both</b></i>')).toEqual([
			[
				{ text: 'Top ', italic: true, bold: false },
				{ text: 'both', italic: true, bold: true }
			]
		]);
		expect(cueToSpans('<i>open\nnext</i>')).toEqual([
			[{ text: 'open', italic: true, bold: false }],
			[{ text: 'next', italic: true, bold: false }]
		]);
		expect(cueToSpans('\r\n\n')).toEqual([]);
	});
});
