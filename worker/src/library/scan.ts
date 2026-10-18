import type { Dirent } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import type { SubtitleTrack } from '../../../src/lib/media/types.js';
import { standardMovieVisibilityWhere } from '../../../src/lib/server/policies/movie-visibility.js';
import { standardTvShowVisibilityWhere } from '../../../src/lib/server/policies/tv-visibility.js';
import { schema } from '../db.js';
import { episodeKey, ingestTvShow, type TvIngestResult, type WorkerDb } from '../tv/ingest-tv.js';
import { Matcher, type MatchResult } from './match.js';
import { parseMediaPath, type ParsedMediaName } from './parse-name.js';
import type { ProbeResult } from './probe.js';
import { matchSidecars, SUBS_FOLDER, type SidecarCandidate } from './sidecars.js';

/**
 * Library scanner: walks the owner's media roots (READ-ONLY: it only lists, stats and probes
 * files), parses and matches every video, makes sure the matched film or show exists in the
 * catalogue (through the safety-checked ingests), and upserts one media_files row per path.
 *
 * - Stable ids: rows are keyed by path; an unchanged file (same size and mtime) is neither
 *   re-probed nor re-matched, and a row is written only when something in it changed.
 * - Rows whose file vanished under a scanned root are deleted (never when the root is missing or
 *   came back empty, which looks like an unplugged drive rather than a deleted library).
 * - Files with an explicit name are skipped and never stored.
 * - A match is linked only to a standard (non-adult, non-quarantined) catalogue row.
 */

export const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.m4v']);
const SUBTITLE_EXTENSIONS = new Set(['.srt', '.ass', '.ssa', '.vtt']);
export const MIN_FILM_BYTES = 300 * 1024 * 1024;
export const MIN_EPISODE_BYTES = 50 * 1024 * 1024;
const SAMPLE = /(?:^|[^a-z])sample(?:[^a-z]|$)/iu;
const PROBE_CONCURRENCY = 4;
const SHOW_REFRESH_MS = 12 * 60 * 60 * 1000;

export interface WalkedVideo {
	root: string;
	path: string;
	relativePath: string;
	sizeBytes: number;
	mtimeMs: number;
	sidecars: Array<{
		path: string;
		codec: string;
		language: string | null;
		title: string | null;
		forced: boolean;
	}>;
}

export interface WalkResult {
	root: string;
	ok: boolean;
	videos: WalkedVideo[];
	skippedSmall: number;
	skippedSample: number;
}

export interface ScanDependencies {
	db: WorkerDb | null;
	matcher: Matcher;
	probe: (filePath: string) => Promise<ProbeResult>;
	/** Ingests a film (with its own safety checks); resolves to the row id or null when skipped. */
	ingestMovie: (tmdbId: number) => Promise<string | null>;
	ingestShow?: (tmdbId: number, seasons: number[]) => Promise<TvIngestResult>;
	log?: (message: string) => void;
}

export interface ScanOptions {
	roots: string[];
	dryRun?: boolean;
	minFilmBytes?: number;
	minEpisodeBytes?: number;
}

export interface ScanSummary {
	dryRun: boolean;
	roots: number;
	missingRoots: number;
	videosFound: number;
	skippedSmall: number;
	skippedSample: number;
	skippedExplicit: number;
	probed: number;
	probeReused: number;
	probeFailed: number;
	matchedMovies: number;
	matchedEpisodes: number;
	unmatched: number;
	ambiguous: number;
	moviesIngested: number;
	showsIngested: number;
	inserted: number;
	updated: number;
	unchanged: number;
	deleted: number;
	sidecarSubtitles: number;
	tmdbSearches: number;
	timingsMs: Record<string, number>;
	/** Library-relative paths, only for files that need attention. */
	unmatchedFiles: Array<{ path: string; note: string }>;
	ambiguousFiles: Array<{ path: string; note: string }>;
}

type MediaFileRow = typeof schema.mediaFiles.$inferSelect;

interface Planned {
	video: WalkedVideo;
	parsed: ParsedMediaName;
	existing: MediaFileRow | null;
	probe: ProbeResult | null;
	probeError: string | null;
	match: MatchResult | null;
	movieId: string | null;
	episodeId: string | null;
	status: 'matched' | 'unmatched' | 'ambiguous';
	note: string | null;
}

function sameFolderKey(value: string): string {
	return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isUnder(filePath: string, root: string): boolean {
	const file = sameFolderKey(filePath);
	const base = sameFolderKey(root.endsWith(path.sep) ? root : root + path.sep);
	return file.startsWith(base);
}

async function listDirectory(directory: string): Promise<Dirent[] | null> {
	try {
		return await readdir(directory, { withFileTypes: true });
	} catch {
		return null;
	}
}

/** Lists the videos of one root with their sidecar subtitles. Only reads the file system. */
export async function walkRoot(
	rootInput: string,
	options: { minFilmBytes?: number; minEpisodeBytes?: number } = {}
): Promise<WalkResult> {
	const root = path.resolve(rootInput);
	const minFilm = options.minFilmBytes ?? MIN_FILM_BYTES;
	const minEpisode = options.minEpisodeBytes ?? MIN_EPISODE_BYTES;
	const result: WalkResult = { root, ok: false, videos: [], skippedSmall: 0, skippedSample: 0 };
	const rootStat = await stat(root).catch(() => null);
	if (!rootStat?.isDirectory()) return result;
	result.ok = true;

	const pending = [root];
	while (pending.length > 0) {
		const directory = pending.shift()!;
		const entries = await listDirectory(directory);
		if (!entries) continue;
		const videos: Dirent[] = [];
		const subtitles: SidecarCandidate[] = [];
		for (const entry of entries) {
			const full = path.join(directory, entry.name);
			// Symbolic links are never followed: the scan stays inside its roots.
			if (entry.isSymbolicLink()) continue;
			if (entry.isDirectory()) {
				if (SAMPLE.test(entry.name)) continue;
				pending.push(full);
				if (SUBS_FOLDER.test(entry.name)) {
					for (const sub of (await listDirectory(full)) ?? []) {
						if (sub.isFile() && SUBTITLE_EXTENSIONS.has(path.extname(sub.name).toLowerCase())) {
							subtitles.push({
								path: path.join(full, sub.name),
								name: sub.name,
								inSubsFolder: true
							});
						}
					}
				}
				continue;
			}
			if (!entry.isFile()) continue;
			const extension = path.extname(entry.name).toLowerCase();
			if (VIDEO_EXTENSIONS.has(extension)) videos.push(entry);
			else if (SUBTITLE_EXTENSIONS.has(extension)) {
				subtitles.push({ path: full, name: entry.name, inSubsFolder: false });
			}
		}

		for (const entry of videos) {
			const full = path.join(directory, entry.name);
			if (SAMPLE.test(path.parse(entry.name).name)) {
				result.skippedSample++;
				continue;
			}
			const info = await stat(full).catch(() => null);
			if (!info) continue;
			const relativePath = path.relative(root, full).split(path.sep).join('/');
			const isEpisode = parseMediaPath(relativePath).kind === 'episode';
			if (info.size < (isEpisode ? minEpisode : minFilm)) {
				result.skippedSmall++;
				continue;
			}
			result.videos.push({
				root,
				path: full,
				relativePath,
				sizeBytes: info.size,
				mtimeMs: Math.trunc(info.mtimeMs),
				sidecars: matchSidecars(entry.name, subtitles, videos.length)
			});
		}
	}
	result.videos.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
	return result;
}

async function mapPool<T, R>(
	items: T[],
	limit: number,
	task: (item: T) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	async function worker() {
		while (next < items.length) {
			const index = next++;
			results[index] = await task(items[index]);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

/** JSON with sorted keys, so jsonb values read back from PostgreSQL compare equal. */
function stable(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, inner]) => inner !== undefined)
			.sort(([a], [b]) => a.localeCompare(b));
		return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${stable(inner)}`).join(',')}}`;
	}
	return JSON.stringify(value ?? null);
}

function storedProbe(row: MediaFileRow): ProbeResult {
	return {
		durationSeconds: row.durationSeconds,
		video: row.video ?? null,
		audioTracks: row.audioTracks ?? [],
		subtitleTracks: (row.subtitleTracks ?? []).filter((track) => track.source !== 'external')
	};
}

function withSidecars(probe: ProbeResult, video: WalkedVideo) {
	const embedded = probe.subtitleTracks.filter((track) => track.source !== 'external');
	const external: SubtitleTrack[] = video.sidecars.map((sidecar, index) => ({
		ordinal: embedded.length + index,
		source: 'external',
		codec: sidecar.codec,
		language: sidecar.language,
		title: sidecar.title,
		forced: sidecar.forced,
		isText: true
	}));
	return {
		subtitleTracks: [...embedded, ...external],
		externalSubtitles: video.sidecars.map((sidecar, index) => ({
			ordinal: embedded.length + index,
			path: sidecar.path,
			language: sidecar.language
		}))
	};
}

function emptySummary(dryRun: boolean, roots: number): ScanSummary {
	return {
		dryRun,
		roots,
		missingRoots: 0,
		videosFound: 0,
		skippedSmall: 0,
		skippedSample: 0,
		skippedExplicit: 0,
		probed: 0,
		probeReused: 0,
		probeFailed: 0,
		matchedMovies: 0,
		matchedEpisodes: 0,
		unmatched: 0,
		ambiguous: 0,
		moviesIngested: 0,
		showsIngested: 0,
		inserted: 0,
		updated: 0,
		unchanged: 0,
		deleted: 0,
		sidecarSubtitles: 0,
		tmdbSearches: 0,
		timingsMs: {},
		unmatchedFiles: [],
		ambiguousFiles: []
	};
}

function episodeLabel(parsed: ParsedMediaName): string {
	const pad = (value: number | null) => String(value ?? 0).padStart(2, '0');
	return `S${pad(parsed.season)}E${pad(parsed.episode)}`;
}

/** Scans the roots and synchronises media_files. See the module comment for the rules. */
export async function scanLibrary(
	options: ScanOptions,
	deps: ScanDependencies
): Promise<ScanSummary> {
	const dryRun = options.dryRun === true;
	const log = deps.log ?? (() => undefined);
	const summary = emptySummary(dryRun, options.roots.length);
	const db = deps.db;
	if (!db && !dryRun) throw new Error('A database is required unless --dry-run is set.');
	let clock = Date.now();
	const lap = (name: string) => {
		const now = Date.now();
		summary.timingsMs[name] = now - clock;
		clock = now;
	};

	// 1. Walk (read-only).
	const walks: WalkResult[] = [];
	for (const root of options.roots) {
		const walk = await walkRoot(root, options);
		walks.push(walk);
		if (!walk.ok) {
			summary.missingRoots++;
			log(`Root not found or not a folder: ${walk.root}`);
		}
		summary.skippedSmall += walk.skippedSmall;
		summary.skippedSample += walk.skippedSample;
	}
	const videos = walks.flatMap((walk) => walk.videos);
	summary.videosFound = videos.length;
	lap('walk');

	// 2. Existing rows.
	const existingRows: MediaFileRow[] = db ? await db.select().from(schema.mediaFiles) : [];
	const existingByPath = new Map(existingRows.map((row) => [sameFolderKey(row.path), row]));
	lap('load');

	// 3. Parse; skip explicit names entirely.
	const planned: Planned[] = [];
	for (const video of videos) {
		const parsed = parseMediaPath(video.relativePath);
		if (parsed.explicit) {
			summary.skippedExplicit++;
			continue;
		}
		planned.push({
			video,
			parsed,
			existing: existingByPath.get(sameFolderKey(video.path)) ?? null,
			probe: null,
			probeError: null,
			match: null,
			movieId: null,
			episodeId: null,
			status: 'unmatched',
			note: null
		});
	}

	// 4. Probe new or changed files, 4 at a time; reuse stored streams otherwise.
	const unchanged = (item: Planned) =>
		item.existing !== null &&
		item.existing.sizeBytes === item.video.sizeBytes &&
		item.existing.mtimeMs === item.video.mtimeMs &&
		item.existing.video !== null;
	await mapPool(planned, PROBE_CONCURRENCY, async (item) => {
		if (unchanged(item)) {
			item.probe = storedProbe(item.existing!);
			summary.probeReused++;
			return;
		}
		try {
			item.probe = await deps.probe(item.video.path);
			summary.probed++;
		} catch (error) {
			item.probeError = error instanceof Error ? error.message.slice(0, 200) : 'probe failed';
			summary.probeFailed++;
		}
	});
	lap('probe');

	// 5. Match. An unchanged file already linked under the same parse keeps its link.
	const keepsLink = (item: Planned) =>
		unchanged(item) &&
		item.existing!.matchStatus === 'matched' &&
		(item.existing!.movieId !== null || item.existing!.episodeId !== null) &&
		stable(item.existing!.parsed) === stable(item.parsed);
	for (const item of planned) {
		if (keepsLink(item)) {
			item.movieId = item.existing!.movieId;
			item.episodeId = item.existing!.episodeId;
			item.status = 'matched';
			item.note = item.existing!.matchNote;
			continue;
		}
		item.match = await deps.matcher.match(item.parsed);
	}
	// A kept link stays only while its film or show is still standard content.
	if (db) {
		const keptMovieIds = [
			...new Set(planned.flatMap((item) => (item.match ? [] : [item.movieId ?? ''])))
		].filter(Boolean);
		const keptEpisodeIds = [
			...new Set(planned.flatMap((item) => (item.match ? [] : [item.episodeId ?? ''])))
		].filter(Boolean);
		const standardMovies = new Set(
			keptMovieIds.length === 0
				? []
				: (
						await db
							.select({ id: schema.movies.id })
							.from(schema.movies)
							.where(and(inArray(schema.movies.id, keptMovieIds), standardMovieVisibilityWhere()))
					).map((row) => row.id)
		);
		const standardEpisodes = new Set(
			keptEpisodeIds.length === 0
				? []
				: (
						await db
							.select({ id: schema.tvEpisodes.id })
							.from(schema.tvEpisodes)
							.innerJoin(schema.tvShows, eq(schema.tvShows.id, schema.tvEpisodes.showId))
							.where(
								and(inArray(schema.tvEpisodes.id, keptEpisodeIds), standardTvShowVisibilityWhere())
							)
					).map((row) => row.id)
		);
		for (const item of planned) {
			if (item.match) continue;
			const visible = item.movieId
				? standardMovies.has(item.movieId)
				: standardEpisodes.has(item.episodeId ?? '');
			if (visible) continue;
			item.movieId = null;
			item.episodeId = null;
			item.status = 'unmatched';
			item.note = 'excluded: the catalogue row is no longer standard content';
		}
	}
	summary.tmdbSearches = deps.matcher.searches;
	lap('match');

	// 6. Catalogue rows: films one by one, shows once with every season the library needs.
	const movieIds = new Map<number, string | null>();
	const movieNotes = new Map<number, string>();
	for (const item of planned) {
		const match = item.match;
		if (!match || match.status !== 'matched' || match.kind !== 'movie') continue;
		if (movieIds.has(match.tmdbId)) continue;
		let id: string | null = null;
		if (db) {
			const [standard] = await db
				.select({ id: schema.movies.id })
				.from(schema.movies)
				.where(and(eq(schema.movies.tmdbId, match.tmdbId), standardMovieVisibilityWhere()))
				.limit(1);
			id = standard?.id ?? null;
			if (!id) {
				const [any] = await db
					.select({ id: schema.movies.id })
					.from(schema.movies)
					.where(eq(schema.movies.tmdbId, match.tmdbId))
					.limit(1);
				if (any)
					movieNotes.set(match.tmdbId, 'excluded: the catalogue film is not standard content');
				else if (dryRun) {
					summary.moviesIngested++;
					movieNotes.set(match.tmdbId, 'dry run: the film would be ingested first');
				} else {
					const ingested = await deps.ingestMovie(match.tmdbId);
					if (ingested) {
						summary.moviesIngested++;
						const [after] = await db
							.select({ id: schema.movies.id })
							.from(schema.movies)
							.where(and(eq(schema.movies.tmdbId, match.tmdbId), standardMovieVisibilityWhere()))
							.limit(1);
						id = after?.id ?? null;
						if (!id)
							movieNotes.set(match.tmdbId, 'excluded: the ingested film is not standard content');
					} else {
						movieNotes.set(match.tmdbId, 'film ingest skipped (safety check or quality threshold)');
					}
				}
			}
		}
		movieIds.set(match.tmdbId, id);
	}

	const wantedByShow = new Map<number, Set<string>>();
	for (const item of planned) {
		const match = item.match;
		if (!match || match.status !== 'matched' || match.kind !== 'tv') continue;
		const wanted = wantedByShow.get(match.tmdbId) ?? new Set<string>();
		if (item.parsed.season !== null && item.parsed.episode !== null) {
			wanted.add(episodeKey(item.parsed.season, item.parsed.episode));
		}
		wantedByShow.set(match.tmdbId, wanted);
	}
	const episodesByShow = new Map<number, Map<string, string> | null>();
	const showNotes = new Map<number, string>();
	for (const [tmdbId, wanted] of wantedByShow) {
		const seasons = [...new Set([...wanted].map((key) => Number(key.split('x')[0])))].sort(
			(a, b) => a - b
		);
		let episodes: Map<string, string> | null = null;
		if (db) {
			const [standard] = await db
				.select({ id: schema.tvShows.id, syncedAt: schema.tvShows.syncedAt })
				.from(schema.tvShows)
				.where(and(eq(schema.tvShows.tmdbId, tmdbId), standardTvShowVisibilityWhere()))
				.limit(1);
			const [any] = standard
				? [{ id: standard.id }]
				: await db
						.select({ id: schema.tvShows.id })
						.from(schema.tvShows)
						.where(eq(schema.tvShows.tmdbId, tmdbId))
						.limit(1);
			if (any && !standard) {
				showNotes.set(tmdbId, 'excluded: the catalogue show is not standard content');
			} else {
				const known = standard
					? await db
							.select({
								id: schema.tvEpisodes.id,
								season: schema.tvEpisodes.seasonNumber,
								episode: schema.tvEpisodes.episodeNumber
							})
							.from(schema.tvEpisodes)
							.where(
								and(
									eq(schema.tvEpisodes.showId, standard.id),
									inArray(schema.tvEpisodes.seasonNumber, seasons)
								)
							)
					: [];
				episodes = new Map(known.map((row) => [episodeKey(row.season, row.episode), row.id]));
				// Fetch from TMDB when an episode the library needs is missing, unless the show was
				// synced recently (TMDB may simply not list it yet): re-runs stay quiet and idempotent.
				const missing = [...wanted].some((key) => !episodes!.has(key));
				const fresh =
					standard?.syncedAt instanceof Date &&
					Date.now() - standard.syncedAt.getTime() < SHOW_REFRESH_MS;
				if (missing && !fresh && dryRun) {
					summary.showsIngested++;
					showNotes.set(tmdbId, 'dry run: the show and its season(s) would be ingested first');
					episodes = null;
				} else if (missing && !fresh) {
					const ingest =
						deps.ingestShow ??
						((id: number, wanted: number[]) => ingestTvShow(id, { seasons: wanted, db, log }));
					const result = await ingest(tmdbId, seasons);
					if (result.status === 'ingested' || result.status === 'locked') {
						if (result.status === 'ingested') summary.showsIngested++;
						const [visible] = await db
							.select({ id: schema.tvShows.id })
							.from(schema.tvShows)
							.where(and(eq(schema.tvShows.id, result.showId), standardTvShowVisibilityWhere()))
							.limit(1);
						if (visible) episodes = new Map(result.episodes);
						else {
							episodes = null;
							showNotes.set(tmdbId, 'excluded: the ingested show is not standard content');
						}
					} else if (result.status === 'blocked') {
						episodes = null;
						showNotes.set(
							tmdbId,
							`excluded: show failed the content safety check (${result.reason})`
						);
					} else {
						episodes = null;
						showNotes.set(tmdbId, `show ingest ${result.status}`);
					}
				}
			}
		}
		episodesByShow.set(tmdbId, episodes);
	}
	lap('catalogue');

	// 7. Resolve each file's link and status.
	for (const item of planned) {
		if (item.match === null) continue; // kept (or revoked) link
		const match = item.match!;
		const parseNote = item.parsed.note ?? null;
		if (match.status === 'unmatched') {
			item.status = 'unmatched';
			item.note = match.note;
		} else if (match.status === 'ambiguous') {
			item.status = 'ambiguous';
			item.note = match.note;
		} else if (match.kind === 'movie') {
			item.movieId = movieIds.get(match.tmdbId) ?? null;
			item.status = item.movieId ? 'matched' : 'unmatched';
			item.note = item.movieId
				? [match.note, parseNote].filter(Boolean).join('; ') || null
				: (movieNotes.get(match.tmdbId) ??
					`TMDB film #${match.tmdbId} is not in the catalogue yet`);
		} else {
			const episodes = episodesByShow.get(match.tmdbId) ?? null;
			const key =
				item.parsed.season !== null && item.parsed.episode !== null
					? episodeKey(item.parsed.season, item.parsed.episode)
					: null;
			item.episodeId = episodes && key ? (episodes.get(key) ?? null) : null;
			item.status = item.episodeId ? 'matched' : 'unmatched';
			item.note = item.episodeId
				? [match.note, parseNote].filter(Boolean).join('; ') || null
				: (showNotes.get(match.tmdbId) ??
					(episodes
						? `${episodeLabel(item.parsed)} is not on TMDB for show #${match.tmdbId}`
						: `TMDB show #${match.tmdbId} is not in the catalogue yet`));
		}
		if (item.probeError)
			item.note = [item.note, `probe failed: ${item.probeError}`].filter(Boolean).join('; ');
	}

	// 8. Write rows that changed, then remove rows whose file vanished.
	const keptPaths = new Set(planned.map((item) => sameFolderKey(item.video.path)));
	for (const item of planned) {
		if (item.status === 'matched') {
			if (item.movieId) summary.matchedMovies++;
			else summary.matchedEpisodes++;
		} else if (item.status === 'ambiguous') {
			summary.ambiguous++;
			summary.ambiguousFiles.push({ path: item.video.relativePath, note: item.note ?? '' });
		} else {
			summary.unmatched++;
			summary.unmatchedFiles.push({ path: item.video.relativePath, note: item.note ?? '' });
		}
		summary.sidecarSubtitles += item.video.sidecars.length;

		const probe = item.probe ?? (item.existing ? storedProbe(item.existing) : null);
		const subtitles = probe
			? withSidecars(probe, item.video)
			: { subtitleTracks: [], externalSubtitles: [] };
		const values = {
			path: item.video.path,
			sizeBytes: item.video.sizeBytes,
			mtimeMs: item.video.mtimeMs,
			durationSeconds: probe?.durationSeconds ?? null,
			video: probe?.video ?? null,
			audioTracks: probe?.audioTracks ?? [],
			subtitleTracks: subtitles.subtitleTracks,
			externalSubtitles: subtitles.externalSubtitles,
			movieId: item.movieId,
			episodeId: item.episodeId,
			matchStatus: item.status,
			matchNote: item.note,
			parsed: item.parsed
		};
		if (item.existing) {
			const before = stable({
				path: item.existing.path,
				sizeBytes: item.existing.sizeBytes,
				mtimeMs: item.existing.mtimeMs,
				durationSeconds: item.existing.durationSeconds,
				video: item.existing.video,
				audioTracks: item.existing.audioTracks,
				subtitleTracks: item.existing.subtitleTracks,
				externalSubtitles: item.existing.externalSubtitles,
				movieId: item.existing.movieId,
				episodeId: item.existing.episodeId,
				matchStatus: item.existing.matchStatus,
				matchNote: item.existing.matchNote,
				parsed: item.existing.parsed
			});
			if (before === stable(values)) {
				summary.unchanged++;
				continue;
			}
			summary.updated++;
		} else {
			summary.inserted++;
		}
		if (dryRun || !db) continue;
		const now = new Date();
		await db
			.insert(schema.mediaFiles)
			.values({ ...values, scannedAt: now })
			.onConflictDoUpdate({
				target: schema.mediaFiles.path,
				set: { ...values, scannedAt: now, updatedAt: now }
			});
	}

	for (const walk of walks) {
		if (!walk.ok) continue;
		const underRoot = existingRows.filter((row) => isUnder(row.path, walk.root));
		const vanished = underRoot.filter((row) => !keptPaths.has(sameFolderKey(row.path)));
		if (vanished.length === 0) continue;
		if (walk.videos.length === 0) {
			log(`Root ${walk.root} came back empty: keeping its ${underRoot.length} row(s).`);
			continue;
		}
		summary.deleted += vanished.length;
		if (dryRun || !db) continue;
		await db.delete(schema.mediaFiles).where(
			inArray(
				schema.mediaFiles.id,
				vanished.map((row) => row.id)
			)
		);
	}
	lap('write');

	summary.unmatchedFiles.sort((a, b) => a.path.localeCompare(b.path));
	summary.ambiguousFiles.sort((a, b) => a.path.localeCompare(b.path));
	return summary;
}
