import { TmdbHttp } from '../tv/tmdb-http.js';
import type { ParsedMediaName } from './parse-name.js';

/**
 * Matches a parsed file name to a TMDB film or show.
 *
 * Search: /search/movie (with `year`) or /search/tv (with `first_air_date_year`), in French first
 * (the library is mostly French, and the French title comes back next to the original one), then
 * in English when no French result fits. Without a fitting answer the matcher retries without the
 * year, with the alternate title, and with one or two trailing words dropped (typos such as
 * "Sociers"). The answer is cached per title, so a season of episodes costs one search.
 *
 * Score: best similarity between the file's titles and the candidate's titles (normalised edit
 * distance, token overlap, and a prefix rule for subtitles such as "Wake Up Dead Man: A Knives Out
 * Mystery"), plus a year term and a part-number term. 'ambiguous' when the top two are close and
 * neither clearly dominates by votes or popularity; 'unmatched' when nothing is similar enough.
 * Adult candidates are dropped defensively (the ingest's own safety check still runs).
 */

export interface MovieCandidate {
	id: number;
	title: string;
	original_title: string;
	release_date: string;
	popularity: number;
	vote_count: number;
	adult?: boolean;
	original_language?: string;
}

export interface TvCandidate {
	id: number;
	name: string;
	original_name: string;
	first_air_date: string;
	popularity: number;
	vote_count: number;
	adult?: boolean;
	original_language?: string;
	origin_country?: string[];
}

/** Where search results come from (TMDB in production, a fake in tests). */
export interface MatchSource {
	searchMovie(query: string, year: number | null, language: string): Promise<MovieCandidate[]>;
	searchTv(query: string, year: number | null, language: string): Promise<TvCandidate[]>;
}

export type MatchKind = 'movie' | 'tv';

export interface ScoredCandidate {
	tmdbId: number;
	title: string;
	year: number | null;
	similarity: number;
	score: number;
	votes: number;
	popularity: number;
}

export type MatchResult =
	| {
			status: 'matched';
			kind: MatchKind;
			tmdbId: number;
			title: string;
			year: number | null;
			score: number;
			note: string | null;
	  }
	| { status: 'ambiguous'; kind: MatchKind; candidates: ScoredCandidate[]; note: string }
	| { status: 'unmatched'; kind: MatchKind | null; note: string };

export const PRIMARY_LANGUAGE = 'fr-FR';
export const SECONDARY_LANGUAGE = 'en-US';
const MIN_SIMILARITY = 0.75;
const AMBIGUITY_MARGIN = 0.05;
const MAX_DROPPED_WORDS = 2;

/** Lower-case, accent-free, punctuation-free form used for every comparison. */
export function comparable(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{M}+/gu, '')
		.toLowerCase()
		.replace(/&/gu, ' and ')
		.replace(/['’‘`.]/gu, '')
		.replace(/[^a-z0-9]+/gu, ' ')
		.trim();
}

function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
		}
		previous = current;
	}
	return previous[b.length];
}

// "F1 The Movie" is TMDB's "F1" ("F1® Le Film" in French).
const GENERIC_SUFFIX = / (?:the movie|le film|the series|la serie)$/u;

/** 0..1 similarity of two titles (1 = same normalised title). */
export function similarity(left: string, right: string): number {
	const a = comparable(left);
	const b = comparable(right);
	if (!a || !b) return 0;
	if (a === b) return 1;
	const bareA = a.replace(GENERIC_SUFFIX, '');
	const bareB = b.replace(GENERIC_SUFFIX, '');
	if ((bareA !== a || bareB !== b) && bareA === bareB) return 1;

	const edit = 1 - levenshtein(a, b) / Math.max(a.length, b.length);

	const tokensA = a.split(' ');
	const tokensB = b.split(' ');
	const setB = new Set(tokensB);
	const shared = new Set(tokensA.filter((token) => setB.has(token))).size;
	const dice = (2 * shared) / (new Set(tokensA).size + setB.size);

	// "Wake Up Dead Man" vs "Wake Up Dead Man A Knives Out Mystery": a 3+ word title that starts
	// the other one is the same work with or without its subtitle.
	const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
	const prefix = shorter.split(' ').length >= 3 && longer.startsWith(`${shorter} `) ? 0.85 : 0;

	return Math.max(edit, dice, prefix);
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };

/** Part number written in a title ("1re partie", "Part 2", "partie II"), or null. */
export function partNumber(title: string): number | null {
	const text = comparable(title);
	const before = /\b(\d|i{1,3}|iv|v)(?:re|er|e|eme|nd|st|rd|th)?\s+(?:partie|part)\b/u.exec(text);
	const after = /\b(?:partie|part)\s+(\d|i{1,3}|iv|v|one|two)\b/u.exec(text);
	const raw = before?.[1] ?? after?.[1];
	if (!raw) return null;
	if (raw === 'one') return 1;
	if (raw === 'two') return 2;
	return /^\d$/u.test(raw) ? Number(raw) : (ROMAN[raw] ?? null);
}

function yearOf(date: string | null | undefined): number | null {
	const year = Number(String(date ?? '').slice(0, 4));
	return Number.isInteger(year) && year >= 1870 ? year : null;
}

interface Normalised {
	id: number;
	titles: string[];
	label: string;
	year: number | null;
	votes: number;
	popularity: number;
	adult: boolean;
}

function fromMovie(candidate: MovieCandidate): Normalised {
	return {
		id: candidate.id,
		titles: [candidate.title, candidate.original_title].filter(Boolean),
		label: candidate.title,
		year: yearOf(candidate.release_date),
		votes: candidate.vote_count ?? 0,
		popularity: candidate.popularity ?? 0,
		adult: candidate.adult === true
	};
}

function fromShow(candidate: TvCandidate): Normalised {
	return {
		id: candidate.id,
		titles: [candidate.name, candidate.original_name].filter(Boolean),
		label: candidate.name,
		year: yearOf(candidate.first_air_date),
		votes: candidate.vote_count ?? 0,
		popularity: candidate.popularity ?? 0,
		adult: candidate.adult === true
	};
}

function yearTerm(wanted: number | null, found: number | null): number {
	if (wanted === null) return 0;
	if (found === null) return -0.05;
	const distance = Math.abs(wanted - found);
	if (distance === 0) return 0.1;
	if (distance === 1) return 0.04;
	return -Math.min(0.1 * distance, 0.5);
}

function partTerm(wanted: number | null | undefined, titles: string[]): number {
	if (!wanted) return 0;
	const found = titles.map(partNumber).find((part) => part !== null) ?? null;
	if (found === null) return 0;
	return found === wanted ? 0.2 : -0.3;
}

function dominates(top: ScoredCandidate, other: ScoredCandidate): boolean {
	const lead = top.votes / Math.max(other.votes, 1);
	const byVotes = (top.votes >= 10 && lead >= 10) || (top.votes >= 50 && lead >= 5);
	const byPopularity = top.popularity >= 2 && top.popularity >= 5 * Math.max(other.popularity, 0.1);
	return byVotes || byPopularity;
}

type Decision =
	| { status: 'matched'; top: ScoredCandidate; note: string | null }
	| { status: 'ambiguous'; candidates: ScoredCandidate[] }
	| { status: 'none' };

function decide(scored: ScoredCandidate[]): Decision {
	const ranked = [...scored].sort(
		(a, b) => b.score - a.score || b.votes - a.votes || a.tmdbId - b.tmdbId
	);
	const top = ranked[0];
	if (!top || top.similarity < MIN_SIMILARITY || top.score < MIN_SIMILARITY)
		return { status: 'none' };
	const contenders = ranked
		.slice(1)
		.filter(
			(other) => other.similarity >= MIN_SIMILARITY && top.score - other.score < AMBIGUITY_MARGIN
		);
	if (contenders.length === 0) return { status: 'matched', top, note: null };
	if (contenders.every((other) => dominates(top, other))) {
		return { status: 'matched', top, note: 'chosen over a same-title work by popularity' };
	}
	return { status: 'ambiguous', candidates: [top, ...contenders] };
}

function shortenedQueries(title: string): string[] {
	const words = title.split(/\s+/u).filter(Boolean);
	const queries: string[] = [];
	for (let drop = 1; drop <= MAX_DROPPED_WORDS && words.length - drop >= 2; drop++) {
		const query = words
			.slice(0, words.length - drop)
			.join(' ')
			.replace(/[\s\-:,]+$/u, '');
		if (query.split(' ').length >= 2) queries.push(query);
	}
	return queries;
}

export class Matcher {
	private readonly cache = new Map<string, Promise<MatchResult>>();
	searches = 0;

	constructor(private readonly source: MatchSource) {}

	/** The TMDB match of a parsed name; one search sequence per distinct title. */
	match(parsed: ParsedMediaName): Promise<MatchResult> {
		if (parsed.explicit || parsed.kind === 'unknown' || !parsed.title.trim()) {
			return Promise.resolve({
				status: 'unmatched',
				kind: null,
				note: parsed.explicit ? 'excluded: explicit name' : 'no usable title in the name'
			});
		}
		const kind: MatchKind = parsed.kind === 'episode' ? 'tv' : 'movie';
		const key = [
			kind,
			comparable(parsed.title),
			parsed.year ?? '',
			parsed.partHint ?? '',
			comparable(parsed.alternateTitle ?? '')
		].join('|');
		let pending = this.cache.get(key);
		if (!pending) {
			pending = this.search(kind, parsed);
			this.cache.set(key, pending);
		}
		return pending;
	}

	private async run(
		kind: MatchKind,
		query: string,
		year: number | null,
		language: string
	): Promise<Normalised[]> {
		this.searches++;
		const results =
			kind === 'movie'
				? (await this.source.searchMovie(query, year, language)).map(fromMovie)
				: (await this.source.searchTv(query, year, language)).map(fromShow);
		return results.filter((candidate) => !candidate.adult && Number.isInteger(candidate.id));
	}

	private score(parsed: ParsedMediaName, candidates: Map<number, Normalised>): ScoredCandidate[] {
		const names = [parsed.title, parsed.alternateTitle].filter(
			(name): name is string => typeof name === 'string' && name.length > 0
		);
		const nameTokens = new Set(names.flatMap((name) => comparable(name).split(' ')));
		return [...candidates.values()].map((candidate) => {
			let best = 0;
			for (const name of names) {
				for (const title of candidate.titles) best = Math.max(best, similarity(name, title));
			}
			// "Star Wars Episode IV A New Hope (1977)" is TMDB's "Star Wars" (1977): a 2+ word TMDB
			// title wholly contained in the name counts only when the year is exactly the same.
			if (best < 0.8 && parsed.year !== null && candidate.year === parsed.year) {
				for (const title of candidate.titles) {
					const tokens = comparable(title).split(' ').filter(Boolean);
					if (tokens.length >= 2 && tokens.every((token) => nameTokens.has(token))) best = 0.8;
				}
			}
			return {
				tmdbId: candidate.id,
				title: candidate.label,
				year: candidate.year,
				similarity: Math.round(best * 1000) / 1000,
				score:
					Math.round(
						(best +
							yearTerm(parsed.year, candidate.year) +
							partTerm(parsed.partHint, candidate.titles)) *
							1000
					) / 1000,
				votes: candidate.votes,
				popularity: candidate.popularity
			};
		});
	}

	private async search(kind: MatchKind, parsed: ParsedMediaName): Promise<MatchResult> {
		// TMDB search ignores case; lower-casing makes the cache and the query log uniform.
		const queries = [
			...new Set(
				[parsed.title, parsed.alternateTitle ?? '', ...shortenedQueries(parsed.title)]
					.map((query) => query.trim().toLowerCase())
					.filter((query) => query.length > 0)
			)
		];
		const years = parsed.year !== null ? [parsed.year, null] : [null];
		let sawResults = false;

		for (const query of queries) {
			for (const year of years) {
				const found = await this.run(kind, query, year, PRIMARY_LANGUAGE);
				if (found.length === 0) continue;
				sawResults = true;
				const pool = new Map(found.map((candidate) => [candidate.id, candidate]));
				let decision = decide(this.score(parsed, pool));
				if (decision.status === 'none') {
					// The file may carry the English title of a film whose French title differs.
					for (const candidate of await this.run(kind, query, year, SECONDARY_LANGUAGE)) {
						const known = pool.get(candidate.id);
						if (known) known.titles = [...new Set([...known.titles, ...candidate.titles])];
						else pool.set(candidate.id, candidate);
					}
					decision = decide(this.score(parsed, pool));
				}
				if (decision.status === 'matched') {
					const notes = [
						query !== parsed.title.toLowerCase() ? `matched with query "${query}"` : null,
						year === null && parsed.year !== null ? 'matched without the year' : null,
						decision.note
					].filter(Boolean);
					return {
						status: 'matched',
						kind,
						tmdbId: decision.top.tmdbId,
						title: decision.top.title,
						year: decision.top.year,
						score: decision.top.score,
						note: notes.length > 0 ? notes.join('; ') : null
					};
				}
				if (decision.status === 'ambiguous') {
					return {
						status: 'ambiguous',
						kind,
						candidates: decision.candidates,
						note: `${decision.candidates.length} close candidates: ${decision.candidates
							.map(
								(candidate) => `${candidate.title} (${candidate.year ?? '?'}) #${candidate.tmdbId}`
							)
							.join(', ')}`
					};
				}
			}
		}
		return {
			status: 'unmatched',
			kind,
			note: sawResults ? 'no TMDB result is similar enough' : 'no TMDB result'
		};
	}
}

/** TMDB-backed search source (paced and retried by {@link TmdbHttp}). */
export function createTmdbMatchSource(http: TmdbHttp = new TmdbHttp()): MatchSource {
	return {
		async searchMovie(query, year, language) {
			const params: Record<string, string> = { query, language, include_adult: 'false', page: '1' };
			if (year !== null) params.year = String(year);
			const body = await http.get<{ results?: MovieCandidate[] }>('/search/movie', params);
			return Array.isArray(body?.results) ? body.results : [];
		},
		async searchTv(query, year, language) {
			const params: Record<string, string> = { query, language, include_adult: 'false', page: '1' };
			if (year !== null) params.first_air_date_year = String(year);
			const body = await http.get<{ results?: TvCandidate[] }>('/search/tv', params);
			return Array.isArray(body?.results) ? body.results : [];
		}
	};
}
