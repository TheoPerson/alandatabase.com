// Labels for Alan's HQP: languages, codecs, badges, times and value-first control values. Pure.
import type { Chapter, HdrKind, PlayableFile } from '$lib/media/types';
import type { HqpAudioOption, HqpSubtitleState } from '$lib/player/hqp/types';
import { meaningfulChapterTitle } from '$lib/media/chapter-title';
import { spokenTime } from '$lib/player/format-time';

// [English name, two-letter form] keyed by every ISO 639-1 / 639-2 (B and T) spelling we meet.
const LANGUAGES: Record<string, [string, string]> = {};
const LANGUAGE_ROWS: Array<[string[], string, string]> = [
	[['fre', 'fra', 'fr'], 'French', 'FR'],
	[['eng', 'en'], 'English', 'EN'],
	[['spa', 'es'], 'Spanish', 'ES'],
	[['ger', 'deu', 'de'], 'German', 'DE'],
	[['ita', 'it'], 'Italian', 'IT'],
	[['por', 'pt'], 'Portuguese', 'PT'],
	[['dut', 'nld', 'nl'], 'Dutch', 'NL'],
	[['jpn', 'ja'], 'Japanese', 'JA'],
	[['kor', 'ko'], 'Korean', 'KO'],
	[['chi', 'zho', 'zh'], 'Chinese', 'ZH'],
	[['rus', 'ru'], 'Russian', 'RU'],
	[['ara', 'ar'], 'Arabic', 'AR'],
	[['hin', 'hi'], 'Hindi', 'HI'],
	[['swe', 'sv'], 'Swedish', 'SV'],
	[['nor', 'nob', 'nno', 'no', 'nb'], 'Norwegian', 'NO'],
	[['dan', 'da'], 'Danish', 'DA'],
	[['fin', 'fi'], 'Finnish', 'FI'],
	[['pol', 'pl'], 'Polish', 'PL'],
	[['tur', 'tr'], 'Turkish', 'TR'],
	[['gre', 'ell', 'el'], 'Greek', 'EL'],
	[['heb', 'he'], 'Hebrew', 'HE'],
	[['cze', 'ces', 'cs'], 'Czech', 'CS'],
	[['hun', 'hu'], 'Hungarian', 'HU'],
	[['rum', 'ron', 'ro'], 'Romanian', 'RO'],
	[['ukr', 'uk'], 'Ukrainian', 'UK'],
	[['tha', 'th'], 'Thai', 'TH'],
	[['vie', 'vi'], 'Vietnamese', 'VI'],
	[['ind', 'id'], 'Indonesian', 'ID'],
	[['may', 'msa', 'ms'], 'Malay', 'MS'],
	[['cat', 'ca'], 'Catalan', 'CA'],
	[['ice', 'isl', 'is'], 'Icelandic', 'IS'],
	[['srp', 'scc', 'sr'], 'Serbian', 'SR'],
	[['hrv', 'scr', 'hr'], 'Croatian', 'HR'],
	[['bos', 'bs'], 'Bosnian', 'BS'],
	[['slv', 'sl'], 'Slovenian', 'SL'],
	[['slo', 'slk', 'sk'], 'Slovak', 'SK'],
	[['bul', 'bg'], 'Bulgarian', 'BG'],
	[['est', 'et'], 'Estonian', 'ET'],
	[['lav', 'lv'], 'Latvian', 'LV'],
	[['lit', 'lt'], 'Lithuanian', 'LT'],
	[['mac', 'mkd', 'mk'], 'Macedonian', 'MK'],
	[['alb', 'sqi', 'sq'], 'Albanian', 'SQ'],
	[['per', 'fas', 'fa'], 'Persian', 'FA'],
	[['urd', 'ur'], 'Urdu', 'UR'],
	[['ben', 'bn'], 'Bengali', 'BN'],
	[['tam', 'ta'], 'Tamil', 'TA'],
	[['tel', 'te'], 'Telugu', 'TE'],
	[['fil', 'tgl', 'tl'], 'Filipino', 'TL'],
	[['baq', 'eus', 'eu'], 'Basque', 'EU'],
	[['glg', 'gl'], 'Galician', 'GL'],
	[['wel', 'cym', 'cy'], 'Welsh', 'CY'],
	[['gle', 'ga'], 'Irish', 'GA'],
	[['lat', 'la'], 'Latin', 'LA']
];
for (const [codes, name, short] of LANGUAGE_ROWS) {
	for (const code of codes) LANGUAGES[code] = [name, short];
}

// Language words seen in container titles ("FR", "SRB", "Français", "English"): never repeated
// in a detail line, since the row title already names the language.
const LANGUAGE_NAMES = new Set(LANGUAGE_ROWS.map(([, name]) => name.toLowerCase()));
const LOCAL_LANGUAGE_WORDS = new Set([
	'français',
	'francais',
	'anglais',
	'english',
	'deutsch',
	'español',
	'espanol',
	'italiano',
	'português',
	'portugues',
	'srpski',
	'hrvatski',
	'srb',
	'vf',
	'vff',
	'vfq',
	'vo',
	'vost',
	'vostfr'
]);

/** Whether one word of a track title only names a language (or a dub/sub tag such as "VFF"). */
export function isLanguageWord(word: string): boolean {
	const raw = word.trim();
	const value = raw.toLowerCase();
	if (!value) return false;
	// Codes only when written as a tag ("FR", "ENG"), so "it" or "is" in a free title survive.
	const code = raw === raw.toUpperCase() && value in LANGUAGES;
	return code || LANGUAGE_NAMES.has(value) || LOCAL_LANGUAGE_WORDS.has(value);
}

function normalizeCode(code: string | null): string | null {
	const value = code?.trim().toLowerCase();
	if (!value || value === 'und' || value === 'mul' || value === 'zxx') return null;
	return value;
}

export function languageName(code: string | null): string {
	const value = normalizeCode(code);
	if (!value) return 'Unknown';
	return LANGUAGES[value]?.[0] ?? value.toUpperCase();
}

/** Two-letter upper-case form for compact values ("FR"); '' when unknown. */
export function languageShort(code: string | null): string {
	const value = normalizeCode(code);
	if (!value) return '';
	return LANGUAGES[value]?.[1] ?? value.slice(0, 2).toUpperCase();
}

/** Whether a language code is French (for French subtitle typography). */
export function isFrench(code: string | null): boolean {
	return languageShort(code) === 'FR';
}

export function channelLabel(channels: number | null): string | null {
	if (!channels || channels < 1) return null;
	switch (channels) {
		case 1:
			return 'Mono';
		case 2:
			return 'Stereo';
		case 3:
			return '2.1';
		case 6:
			return '5.1';
		case 7:
			return '6.1';
		case 8:
			return '7.1';
		default:
			return `${channels} ch`;
	}
}

const CODECS: Record<string, [string, string]> = {
	eac3: ['Dolby Digital Plus', 'DD+'],
	ac3: ['Dolby Digital', 'DD'],
	truehd: ['Dolby TrueHD', 'TrueHD'],
	aac: ['AAC', 'AAC'],
	dts: ['DTS', 'DTS'],
	flac: ['FLAC', 'FLAC'],
	opus: ['Opus', 'Opus'],
	mp3: ['MP3', 'MP3'],
	vorbis: ['Vorbis', 'Vorbis'],
	pcm_s16le: ['PCM', 'PCM'],
	pcm_s24le: ['PCM', 'PCM'],
	hevc: ['HEVC', 'HEVC'],
	h265: ['HEVC', 'HEVC'],
	h264: ['H.264', 'H.264'],
	avc: ['H.264', 'H.264'],
	av1: ['AV1', 'AV1'],
	vp9: ['VP9', 'VP9'],
	subrip: ['SRT', 'SRT'],
	srt: ['SRT', 'SRT'],
	ass: ['ASS', 'ASS'],
	ssa: ['SSA', 'SSA'],
	webvtt: ['WebVTT', 'WebVTT'],
	mov_text: ['MP4 text', 'MP4 text'],
	hdmv_pgs_subtitle: ['PGS', 'PGS'],
	dvd_subtitle: ['VobSub', 'VobSub']
};

export function codecLabel(codec: string | null, short = false): string | null {
	const value = codec?.trim().toLowerCase();
	if (!value) return null;
	const known = CODECS[value];
	if (known) return short ? known[1] : known[0];
	return value.toUpperCase();
}

export function resolutionBadge(resolution: PlayableFile['resolution']): string | null {
	if (!resolution) return null;
	return resolution === '2160p' ? '4K' : resolution;
}

export function hdrBadge(kind: HdrKind): string | null {
	switch (kind) {
		case 'hdr10':
			return 'HDR10';
		case 'hlg':
			return 'HLG';
		case 'dolby-vision':
			return 'Dolby Vision';
		default:
			return null;
	}
}

function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

/** Local 24-hour time at which playback ends ("22:11"), rounded to the nearest minute. */
export function endsAt(now: Date, remainingSeconds: number, rate: number): string {
	const speed = Number.isFinite(rate) && rate > 0 ? rate : 1;
	const remaining = Number.isFinite(remainingSeconds) ? Math.max(0, remainingSeconds) : 0;
	const end = new Date(now.getTime() + (remaining / speed) * 1000 + 30_000);
	return `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
}

function compactChannels(channels: number | null): string {
	if (!channels || channels < 1) return '';
	if (channels === 2) return '2.0';
	return channelLabel(channels) ?? '';
}

/** Value-first audio summary: "FR 5.1". */
export function audioValue(option: HqpAudioOption | undefined): string {
	if (!option) return 'Audio';
	const value = [languageShort(option.language), compactChannels(option.channels)]
		.filter(Boolean)
		.join(' ');
	return value || 'Audio';
}

/** Value-first subtitle summary: "CC FR", "CC FR forced", "Off". */
export function subtitleValue(state: HqpSubtitleState): string {
	const pick = (ordinal: number | null) =>
		ordinal === null ? undefined : state.options.find((option) => option.ordinal === ordinal);
	const selected = pick(state.selected);
	if (selected) {
		const short = languageShort(selected.language) || selected.label;
		return `CC ${short}${selected.forced ? ' forced' : ''}`;
	}
	const forced = pick(state.forced);
	if (forced) return `CC ${languageShort(forced.language) || forced.label} forced`;
	return 'Off';
}

export { meaningfulChapterTitle };

/** Chapter-aware aria-valuetext for the timeline. */
export function sliderText(position: number, duration: number, chapter: Chapter | null): string {
	const base = `${spokenTime(position)} of ${spokenTime(duration)}`;
	const title = meaningfulChapterTitle(chapter?.title);
	return title ? `${base}, chapter ${title}` : base;
}

/** French typography: U+202F NARROW NO-BREAK SPACE before ? ! : ; (never inside 12:30 or URLs). */
/**
 * Titles typed the French way ("Chapitre deux : La Disparue") keep their punctuation on the line of
 * the word before it: the plain space before : ; ? ! becomes U+202F. Titles without that space
 * ("Alien: Earth") are left alone.
 */
export function titleText(title: string): string {
	return title.replace(/ ([:;?!])/g, ' $1');
}

export function frenchTypography(text: string): string {
	return text.replace(/([^\s?!;:])\s?([?!;:]+)(?=\s|$|[»"”)])/g, '$1 $2');
}
