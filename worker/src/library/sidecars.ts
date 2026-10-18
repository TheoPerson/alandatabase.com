/**
 * External (sidecar) subtitle discovery. Pure: the scanner lists directories and passes the names.
 *
 * - Same folder: "<video base>.<suffixes>.<ext>" (Plex "Film (2025).3959.fra.forced.srt",
 *   "Film.vf.srt", "Film.srt").
 * - A "Subs"/"Subtitles" sub-folder, only when the video is alone in its folder (YTS layout).
 * Only French, English and unknown-language files are kept, French first: a 35-language Subs
 * folder would otherwise drown the player's subtitle menu.
 */

export interface SidecarCandidate {
	path: string;
	name: string;
	inSubsFolder: boolean;
}

export interface SidecarSubtitle {
	path: string;
	codec: 'subrip' | 'ass' | 'webvtt';
	language: string | null;
	title: string | null;
	forced: boolean;
}

export const SUBS_FOLDER = /^(?:subs?|subtitles?|sous[ -]?titres?)$/iu;

const CODEC_BY_EXTENSION: Record<string, SidecarSubtitle['codec']> = {
	srt: 'subrip',
	ass: 'ass',
	ssa: 'ass',
	vtt: 'webvtt'
};

const FRENCH = new Set([
	'fr',
	'fre',
	'fra',
	'french',
	'francais',
	'français',
	'vf',
	'vff',
	'vfq',
	'vostfr'
]);
const ENGLISH = new Set(['en', 'eng', 'english']);
const SDH = new Set(['sdh', 'hi', 'cc']);
const LANGUAGE_RANK: Record<string, number> = { fre: 0, eng: 1 };

function extension(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

function stem(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot === -1 ? name : name.slice(0, dot);
}

function describe(tokens: string[]): Pick<SidecarSubtitle, 'language' | 'title' | 'forced'> & {
	otherLanguage: boolean;
} {
	let language: string | null = null;
	let otherLanguage = false;
	let forced = false;
	let sdh = false;
	for (const raw of tokens) {
		const token = raw.toLowerCase();
		if (FRENCH.has(token)) language ??= 'fre';
		else if (ENGLISH.has(token)) language ??= 'eng';
		else if (token === 'forced') forced = true;
		else if (SDH.has(token)) sdh = true;
		else if (/^[a-z]{3}$/u.test(token) || /^[a-z]{2}$/u.test(token)) otherLanguage = true;
		else if (/^[a-z]{4,}$/u.test(token) && !/^\d+$/u.test(token)) otherLanguage = true;
	}
	return {
		language,
		otherLanguage: language === null && otherLanguage,
		forced,
		title: forced ? 'Forced' : sdh ? 'SDH' : null
	};
}

/** Sidecar subtitles of one video among the candidate files of its folder (and Subs folder). */
export function matchSidecars(
	videoFileName: string,
	candidates: SidecarCandidate[],
	videosInFolder: number
): SidecarSubtitle[] {
	const base = stem(videoFileName);
	const found: Array<SidecarSubtitle & { rank: number }> = [];

	for (const candidate of candidates) {
		const codec = CODEC_BY_EXTENSION[extension(candidate.name)];
		if (!codec) continue;
		let tokens: string[];
		if (candidate.inSubsFolder) {
			if (videosInFolder !== 1) continue;
			tokens = stem(candidate.name).split(/[._\s-]+/u);
		} else {
			const name = stem(candidate.name);
			if (name === base) tokens = [];
			else if (name.startsWith(`${base}.`)) tokens = name.slice(base.length + 1).split('.');
			else continue;
		}
		const info = describe(tokens);
		if (info.otherLanguage) continue;
		const languageRank = info.language === null ? 2 : (LANGUAGE_RANK[info.language] ?? 3);
		const kindRank = info.forced ? 1 : info.title ? 2 : 0;
		found.push({
			path: candidate.path,
			codec,
			language: info.language,
			title: info.title,
			forced: info.forced,
			rank: languageRank * 10 + kindRank
		});
	}

	return found
		.sort((a, b) => a.rank - b.rank || a.path.localeCompare(b.path))
		.map(({ path, codec, language, title, forced }) => ({ path, codec, language, title, forced }));
}
