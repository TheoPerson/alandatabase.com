import type { ParsedName } from '../../../src/lib/media/types.js';

/**
 * Pure file-name parser for the owner's library: turns scene-style and human names into a title,
 * a year and (for episodes) season/episode numbers. No I/O.
 *
 * Extra fields (stored with the parse in media_files.parsed, never sent to clients):
 * - episodeEnd: last episode of a multi-episode file (the file is linked to the first one)
 * - partHint: a trailing "- 1" part number ("... Reliques de la Mort - 1")
 * - alternateTitle: a trailing parenthetical title ("Le Prestige (2006) ... (The Prestige)")
 * - explicit: the name looks explicit; such files are never matched, ingested or stored
 * - note: why a parse is special (multi-episode, folder title, ...)
 */
export interface ParsedMediaName extends ParsedName {
	episodeEnd?: number | null;
	partHint?: number | null;
	alternateTitle?: string | null;
	explicit?: boolean;
	note?: string | null;
}

const MAX_YEAR = new Date().getFullYear() + 1;

// Tags that end a title wherever they appear (lower-case).
const STRONG_TAGS = new Set([
	'2160p',
	'1080p',
	'1080i',
	'720p',
	'576p',
	'480p',
	'4k',
	'uhd',
	'1080',
	'720',
	'web',
	'webrip',
	'web-dl',
	'webdl',
	'bluray',
	'blu-ray',
	'bdrip',
	'brrip',
	'dvdrip',
	'hdtv',
	'hdlight',
	'4klight',
	'mhd',
	'remux',
	'hdrip',
	'multi',
	'multi-vf',
	'vff',
	'vfq',
	'vfi',
	'vf2',
	'vof',
	'vostfr',
	'truefrench',
	'french',
	'vo',
	'x264',
	'x265',
	'h264',
	'h265',
	'hevc',
	'av1',
	'avc',
	'xvid',
	'aac',
	'aac5',
	'ac3',
	'eac3',
	'ddp',
	'ddp5',
	'dd5',
	'dts',
	'dts-hd',
	'flac',
	'atmos',
	'truehd',
	'hdr',
	'hdr10',
	'hdr10+',
	'hdr10plus',
	'dv',
	'sdr',
	'10bit',
	'10-bit',
	'hfr',
	'nf',
	'amz',
	'hmax',
	'atvp',
	'dsnp',
	'repack',
	'proper',
	'internal',
	'restauree',
	'6ch'
]);

// Words that end a title only after a year (or inside a tag run): they are also ordinary words.
const WEAK_TAGS = new Set([
	'doc',
	'en',
	'eng',
	'fr',
	'ad',
	'vf',
	'it',
	'max',
	'light',
	'with',
	'bits',
	'imax',
	'dolby',
	'vision',
	'special',
	'edition',
	'extended',
	'unrated',
	'theatrical',
	'remastered',
	'hybrid',
	'directors',
	"director's",
	'cut',
	'final',
	'version',
	'integrale',
	'uncut',
	'collector',
	'v2',
	'criterion',
	'he-aac',
	'hdlight.x264'
]);

const EXPLICIT_NAME = /(?:^|[^a-z])(xxx|onlyfans?|sextape|porn|nsfw|sluts?)(?:[^a-z]|$)/iu;
const EPISODE =
	/(?:^|[^a-z0-9])s(\d{1,2})[ ._-]?e(\d{1,3})((?:[ ._]?-?[ ._]?e?\d{1,3})*)(?![0-9a-z])/iu;
const SEASON_ONLY =
	/(?:^|[^a-z0-9])(?:s(\d{1,2})|season[ ._]?(\d{1,2})|saison[ ._]?(\d{1,2}))(?![0-9a-z])/iu;
const SEASON_FOLDER = /^(?:season|saison|s)[ ._-]?\d{1,2}$/iu;
const IGNORED_FOLDER =
	/^(?:subs?|extras?|featurettes?|plex versions|original quality|optimized for .*|sample)$/iu;
const PAREN_YEAR = /\((\d{4})\)/u;
const ACRONYM = /(^|[ ._,])((?:\p{Lu}\.){2,}\p{Lu})(?=[ ._,]|$)/gu;
const ELISION = /(^|[ ._,])([cdjlmnpst])\.(?=\p{L}{2,})/giu;
// Private-use placeholder for the dots of an acronym while the name is tokenised.
const ACRONYM_DOT = '';

export function normalizeTitle(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{M}+/gu, '')
		.toLowerCase()
		.replace(/&/gu, ' and ')
		.replace(/\./gu, '')
		.replace(/[^a-z0-9]+/gu, ' ')
		.trim();
}

function isYear(token: string): boolean {
	if (!/^\d{4}$/u.test(token)) return false;
	const year = Number(token);
	return year >= 1900 && year <= MAX_YEAR;
}

function isStrongTag(token: string): boolean {
	const lower = token.toLowerCase();
	if (STRONG_TAGS.has(lower)) return true;
	const head = lower.split('-')[0];
	return head.length > 0 && head !== lower && STRONG_TAGS.has(head);
}

function isTag(token: string): boolean {
	return isStrongTag(token) || WEAK_TAGS.has(token.toLowerCase());
}

/** Splits a raw name into title tokens, keeping acronyms (S.W.A.T.) and French elisions (L'Enfant). */
function tokenize(raw: string): string[] {
	const protectedText = raw
		.replace(/[’‘`]/gu, "'")
		.replace(
			ACRONYM,
			(_match, lead: string, acronym: string) =>
				lead + acronym.replaceAll('.', ACRONYM_DOT) + ACRONYM_DOT
		)
		.replace(ELISION, (_match, lead: string, letter: string) => `${lead}${letter}'`);
	return protectedText
		.replace(/[._,]+/gu, ' ')
		.replace(/[^\p{L}\p{N}'&+\- ]+/gu, ' ')
		.split(/\s+/u)
		.map((token) => token.replaceAll(ACRONYM_DOT, '.').replace(/^'+|'+$/gu, ''))
		.filter((token) => token.length > 0 && token !== "'");
}

function joinTitle(tokens: string[]): string {
	return tokens
		.join(' ')
		.replace(/^[\s\-+]+|[\s\-+]+$/gu, '')
		.replace(/\s{2,}/gu, ' ');
}

function hasLetters(title: string, minimum = 2): boolean {
	return (title.match(/\p{L}/gu) ?? []).length >= minimum;
}

interface TitleYear {
	title: string;
	year: number | null;
}

/** Title and year of a film-like name (no episode marker). */
function parseTitleAndYear(raw: string): TitleYear & { alternateTitle: string | null } {
	let text = raw.replace(/\[[^\]]*\]/gu, ' ').replace(/~[^~]*~/gu, ' ');
	let alternateTitle: string | null = null;

	const paren = PAREN_YEAR.exec(text);
	if (paren && isYear(paren[1]) && hasLetters(text.slice(0, paren.index))) {
		const after = text.slice(paren.index + paren[0].length);
		const groups = [...after.matchAll(/\(([^()]*)\)/gu)].map((match) => match[1].trim());
		for (const group of groups.reverse()) {
			const tokens = tokenize(group);
			if (tokens.length > 0 && !isTag(tokens[0]) && hasLetters(group, 3)) {
				alternateTitle = joinTitle(tokens);
				break;
			}
		}
		return {
			title: joinTitle(tokenize(text.slice(0, paren.index))),
			year: Number(paren[1]),
			alternateTitle
		};
	}

	text = text.replace(/\([^)]*\)/gu, ' ');
	const tokens = tokenize(text);
	// "Web" is also a title word ("Madame.Web.2024.FRENCH"): it only ends the title when no
	// tagged year follows it.
	const firstStrongTag = tokens.findIndex((token, index) => {
		if (index === 0 || !isStrongTag(token)) return false;
		if (token.toLowerCase() !== 'web') return true;
		const year = tokens[index + 1];
		return !(
			year !== undefined &&
			isYear(year) &&
			(tokens[index + 2] === undefined || isTag(tokens[index + 2]))
		);
	});
	const end = firstStrongTag === -1 ? tokens.length : firstStrongTag;

	// A year followed by a tag (or the end) is the release year.
	let yearIndex = -1;
	for (let index = 1; index < end; index++) {
		if (!isYear(tokens[index])) continue;
		const next = tokens[index + 1];
		if (next === undefined || index + 1 === end || isTag(next)) {
			yearIndex = index;
			break;
		}
	}
	if (yearIndex !== -1) {
		return {
			title: joinTitle(tokens.slice(0, yearIndex)),
			year: Number(tokens[yearIndex]),
			alternateTitle
		};
	}

	// A year followed by ordinary words (sports and event recordings): keep those words.
	for (let index = end - 1; index >= 1; index--) {
		if (!isYear(tokens[index])) continue;
		const leftover: string[] = [];
		for (let next = index + 1; next < end && !isTag(tokens[next]); next++)
			leftover.push(tokens[next]);
		return {
			title: joinTitle([...tokens.slice(0, index), ...leftover]),
			year: Number(tokens[index]),
			alternateTitle
		};
	}

	const titleTokens: string[] = [];
	for (const token of tokens.slice(0, end)) {
		if (titleTokens.length > 0 && isTag(token) && WEAK_TAGS.has(token.toLowerCase()) === false)
			break;
		titleTokens.push(token);
	}
	const title = joinTitle(titleTokens);
	return { title: hasLetters(title) ? title : '', year: null, alternateTitle };
}

/** Show title (and optional year) from the text before an episode/season marker. */
function parseShowTitle(raw: string): TitleYear {
	const tokens = tokenize(raw.replace(/\[[^\]]*\]/gu, ' ').replace(/\([^)]*\)/gu, ' '));
	// "Le suicide français - Saison 1_S01E02": drop a trailing "Saison N" / "Season N".
	while (
		tokens.length >= 2 &&
		/^\d{1,2}$/u.test(tokens.at(-1)!) &&
		/^(saison|season)$/iu.test(tokens.at(-2)!)
	) {
		tokens.splice(-2, 2);
	}
	const cut = tokens.findIndex((token, index) => index > 0 && isStrongTag(token));
	const titleTokens = cut === -1 ? tokens : tokens.slice(0, cut);
	let year: number | null = null;
	while (titleTokens.length > 0 && titleTokens.at(-1) === '-') titleTokens.pop();
	if (titleTokens.length >= 2 && isYear(titleTokens.at(-1)!)) year = Number(titleTokens.pop());
	return { title: joinTitle(titleTokens), year };
}

function isWeakEpisodeTitle(title: string): boolean {
	const stripped = title
		.replace(/\b(episode|épisode|ep|part|partie)\b/giu, ' ')
		.replace(/\d+/gu, ' ');
	return !hasLetters(stripped, 2);
}

/** Parses a folder name as a show (season packs) or film folder. */
function parseFolder(folder: string): TitleYear {
	const episode = EPISODE.exec(folder);
	const season = SEASON_ONLY.exec(folder);
	const marker = [episode?.index, season?.index].filter(
		(index): index is number => index !== undefined
	);
	if (marker.length > 0) return parseShowTitle(folder.slice(0, Math.min(...marker)));
	const { title, year } = parseTitleAndYear(folder);
	return { title, year };
}

function usableFolders(segments: string[]): string[] {
	return segments
		.slice(0, -1)
		.reverse()
		.filter((folder) => !SEASON_FOLDER.test(folder.trim()) && !IGNORED_FOLDER.test(folder.trim()));
}

/** Parses a library-relative path ("Folder/Sub/File.mkv"). Folders help when the file name is weak. */
export function parseMediaPath(relativePath: string): ParsedMediaName {
	const segments = relativePath.split(/[\\/]+/u).filter((segment) => segment.length > 0);
	const fileName = segments.at(-1) ?? '';
	const base = fileName.replace(/\.[a-z0-9]{2,4}$/iu, '');

	if (EXPLICIT_NAME.test(relativePath)) {
		return {
			kind: 'unknown',
			title: '',
			year: null,
			season: null,
			episode: null,
			explicit: true,
			note: 'excluded: explicit name'
		};
	}

	const folders = usableFolders(segments);
	const episodeMatch = EPISODE.exec(base);
	if (episodeMatch) {
		const season = Number(episodeMatch[1]);
		const episode = Number(episodeMatch[2]);
		const extra = [...(episodeMatch[3] ?? '').matchAll(/\d{1,3}/gu)].map((match) =>
			Number(match[0])
		);
		const episodeEnd = extra.length > 0 ? Math.max(...extra) : null;
		const markerStart = episodeMatch.index + (/[^a-z0-9]/iu.test(episodeMatch[0][0]) ? 1 : 0);
		let { title, year } = parseShowTitle(base.slice(0, markerStart));
		let note: string | null = null;

		if (isWeakEpisodeTitle(title)) {
			for (const folder of folders) {
				const parsed = parseFolder(folder);
				if (!isWeakEpisodeTitle(parsed.title)) {
					title = parsed.title;
					year = year ?? parsed.year;
					note = 'title from folder';
					break;
				}
			}
		} else if (year === null) {
			// "Young.Sherlock.2026.S01/Young.Sherlock.S01E06": take the season-pack folder's year.
			for (const folder of folders) {
				const parsed = parseFolder(folder);
				if (parsed.year !== null && normalizeTitle(parsed.title) === normalizeTitle(title)) {
					year = parsed.year;
					break;
				}
			}
		}

		if (episodeEnd !== null && episodeEnd > episode) {
			note = `multi-episode S${season}E${episode}-E${episodeEnd}: linked to the first episode`;
		}
		return {
			kind: title ? 'episode' : 'unknown',
			title,
			year,
			season,
			episode,
			episodeEnd: episodeEnd !== null && episodeEnd > episode ? episodeEnd : null,
			note
		};
	}

	let name = base.replace(/^\s*\d{1,2}\s*-\s+(?=\S)/u, '');
	let partHint: number | null = null;
	const part = /\s+-\s+(\d)\s*$/u.exec(name);
	if (part) {
		partHint = Number(part[1]);
		name = name.slice(0, part.index);
	}

	const parsedName = parseTitleAndYear(name);
	const { alternateTitle } = parsedName;
	let { title, year } = parsedName;
	let note: string | null = null;
	// A numeric title is fine next to a separate release year ("1917.2019...").
	const numericTitle = year !== null && /^\d{1,4}$/u.test(title);
	if (!hasLetters(title) && !numericTitle) {
		for (const folder of folders) {
			const parsed = parseFolder(folder);
			if (hasLetters(parsed.title)) {
				({ title, year } = parsed);
				note = 'title from folder';
				break;
			}
		}
	}

	const valid = hasLetters(title) || (year !== null && /^\d{1,4}$/u.test(title));
	return {
		kind: valid ? 'movie' : 'unknown',
		title: valid ? title : '',
		year,
		season: null,
		episode: null,
		partHint,
		alternateTitle,
		note
	};
}
