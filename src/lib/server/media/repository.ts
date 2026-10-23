import {
	and,
	asc,
	count,
	countDistinct,
	desc,
	eq,
	getTableColumns,
	gt,
	inArray,
	isNotNull,
	ne,
	or,
	sql
} from 'drizzle-orm';
import type { PosterItem } from '$lib/catalogue/items';
import type {
	AudioTrack,
	HdrKind,
	MatchStatus,
	MediaFileRecord,
	PlayableFile,
	ProgressEntry,
	SubtitleTrack,
	VideoInfo
} from '$lib/media/types';
import { db } from '../db';
import {
	genres,
	mediaFiles,
	mediaProgress,
	movieGenres,
	movies,
	tvEpisodes,
	tvGenres,
	tvShows
} from '../db/schema';
import { standardMovieVisibilityWhere } from '../policies/movie-visibility';
import { standardTvShowVisibilityWhere } from '../policies/tv-visibility';

/**
 * Data access for the owner's local media library (media_files, media_progress).
 *
 * - No authorization here: every caller checks the owner first (isOwnerUser).
 * - Content policy still applies: films and shows are only ever returned while they are standard
 *   content (same predicates as the catalogue), so a quarantined row stays unreachable.
 * - Paths never leave this module except through getMediaFile / getExternalSubtitlePath, which
 *   only the streaming server uses. PlayableFile and list rows carry ids, never paths.
 * - Malformed ids resolve to null / empty without touching the database.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MAX_IDS = 500;
const MAX_PAGE = 60;
const MAX_CONTINUE = 40;
const COMPLETED_RATIO = 0.92;
const COMPLETED_TAIL_SECONDS = 180;

type MediaFileRow = typeof mediaFiles.$inferSelect;
type Resolution = PlayableFile['resolution'];

function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID.test(value);
}

function uuids(values: unknown[], max = MAX_IDS): string[] {
	return [...new Set(values.filter(isUuid).map((value) => value.toLowerCase()))].slice(0, max);
}

function pageSize(limit: number, max = MAX_PAGE): number {
	return Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), max) : Math.min(24, max);
}

function pageOffset(offset: number): number {
	return Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
}

function matchStatus(value: string): MatchStatus {
	return value === 'matched' || value === 'ambiguous' ? value : 'unmatched';
}

function toRecord(row: MediaFileRow): MediaFileRecord {
	return {
		id: row.id,
		path: row.path,
		sizeBytes: Number(row.sizeBytes),
		durationSeconds: row.durationSeconds ?? null,
		video: row.video ?? null,
		audioTracks: row.audioTracks ?? [],
		subtitleTracks: row.subtitleTracks ?? [],
		movieId: row.movieId ?? null,
		episodeId: row.episodeId ?? null,
		matchStatus: matchStatus(row.matchStatus)
	};
}

/** Resolution class of a stream; width counts too, so a 1920x800 scope film is 1080p. */
export function resolutionOf(video: Pick<VideoInfo, 'width' | 'height'> | null): Resolution {
	if (!video || !(video.height > 0)) return null;
	const { width = 0, height } = video;
	if (height >= 1600 || width >= 3200) return '2160p';
	if (height >= 900 || width >= 1800) return '1080p';
	if (height >= 600 || width >= 1200) return '720p';
	return 'SD';
}

const RESOLUTION_RANK: Record<string, number> = { '2160p': 4, '1080p': 3, '720p': 2, SD: 1 };

/** Best first: resolution, then HDR, then 10-bit, then bitrate, then size (then id, stable). */
function compareBest(a: MediaFileRow, b: MediaFileRow): number {
	const rank = (row: MediaFileRow) => {
		const video = row.video ?? null;
		return [
			RESOLUTION_RANK[resolutionOf(video) ?? ''] ?? 0,
			video && video.hdr !== 'sdr' ? 1 : 0,
			video?.pixFmt?.includes('10') ? 1 : 0,
			video?.bitRate ?? 0,
			Number(row.sizeBytes) || 0
		];
	};
	const left = rank(a);
	const right = rank(b);
	for (let index = 0; index < left.length; index++) {
		if (left[index] !== right[index]) return right[index] - left[index];
	}
	return a.id.localeCompare(b.id);
}

function toPlayable(row: MediaFileRow): PlayableFile {
	const video = row.video ?? null;
	const audio: AudioTrack[] = row.audioTracks ?? [];
	const subtitles: SubtitleTrack[] = row.subtitleTracks ?? [];
	return {
		fileId: row.id,
		durationSeconds: row.durationSeconds ?? null,
		resolution: resolutionOf(video),
		hdr: (video?.hdr ?? 'sdr') as HdrKind,
		audio: audio.map((track) => ({
			ordinal: track.ordinal,
			language: track.language ?? null,
			title: track.title ?? null,
			channels: track.channels ?? null
		})),
		subtitles: subtitles.map((track) => ({
			ordinal: track.ordinal,
			language: track.language ?? null,
			title: track.title ?? null,
			forced: track.forced === true,
			isText: track.isText === true
		}))
	};
}

/** The server-side record of one file (path included), or null. Streaming server only. */
export async function getMediaFile(id: string): Promise<MediaFileRecord | null> {
	if (!isUuid(id)) return null;
	const [row] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).limit(1);
	return row ? toRecord(row) : null;
}

/** The sidecar subtitle path behind an external subtitle ordinal, or null. Server only. */
export async function getExternalSubtitlePath(
	fileId: string,
	ordinal: number
): Promise<string | null> {
	if (!isUuid(fileId) || !Number.isInteger(ordinal) || ordinal < 0) return null;
	const [row] = await db
		.select({ external: mediaFiles.externalSubtitles })
		.from(mediaFiles)
		.where(eq(mediaFiles.id, fileId))
		.limit(1);
	const match = (row?.external ?? []).find((entry) => entry.ordinal === ordinal);
	return typeof match?.path === 'string' && match.path.length > 0 ? match.path : null;
}

/** Playable files of a standard film, best first; [] for anything else. */
export async function getPlayableForMovie(movieId: string): Promise<PlayableFile[]> {
	if (!isUuid(movieId)) return [];
	const rows = await db
		.select(getTableColumns(mediaFiles))
		.from(mediaFiles)
		.innerJoin(movies, eq(movies.id, mediaFiles.movieId))
		.where(
			and(
				eq(mediaFiles.movieId, movieId),
				eq(mediaFiles.matchStatus, 'matched'),
				standardMovieVisibilityWhere()
			)
		);
	return rows.sort(compareBest).map(toPlayable);
}

/** Playable files per episode id (standard shows only), best first; episodes without files are absent. */
export async function getPlayableForEpisodes(
	episodeIds: string[]
): Promise<Map<string, PlayableFile[]>> {
	const ids = uuids(Array.isArray(episodeIds) ? episodeIds : []);
	const result = new Map<string, PlayableFile[]>();
	if (ids.length === 0) return result;
	const rows = await db
		.select(getTableColumns(mediaFiles))
		.from(mediaFiles)
		.innerJoin(tvEpisodes, eq(tvEpisodes.id, mediaFiles.episodeId))
		.innerJoin(tvShows, eq(tvShows.id, tvEpisodes.showId))
		.where(
			and(
				inArray(mediaFiles.episodeId, ids),
				eq(mediaFiles.matchStatus, 'matched'),
				standardTvShowVisibilityWhere()
			)
		);
	const grouped = new Map<string, MediaFileRow[]>();
	for (const row of rows) {
		const list = grouped.get(row.episodeId!) ?? [];
		list.push(row);
		grouped.set(row.episodeId!, list);
	}
	for (const [episodeId, list] of grouped)
		result.set(episodeId, list.sort(compareBest).map(toPlayable));
	return result;
}

export interface LibrarySummary {
	films: number;
	episodes: number;
	shows: number;
	/** Files that are unmatched or ambiguous (need a manual look). */
	unmatched: number;
}

/** Counts for the library page header: standard films/episodes/shows with files. */
export async function getLibrarySummary(): Promise<LibrarySummary> {
	const [films] = await db
		.select({ value: countDistinct(mediaFiles.movieId) })
		.from(mediaFiles)
		.innerJoin(movies, eq(movies.id, mediaFiles.movieId))
		.where(and(eq(mediaFiles.matchStatus, 'matched'), standardMovieVisibilityWhere()));
	const [episodes] = await db
		.select({
			episodes: countDistinct(mediaFiles.episodeId),
			shows: countDistinct(tvEpisodes.showId)
		})
		.from(mediaFiles)
		.innerJoin(tvEpisodes, eq(tvEpisodes.id, mediaFiles.episodeId))
		.innerJoin(tvShows, eq(tvShows.id, tvEpisodes.showId))
		.where(and(eq(mediaFiles.matchStatus, 'matched'), standardTvShowVisibilityWhere()));
	const [unmatched] = await db
		.select({ value: count() })
		.from(mediaFiles)
		.where(ne(mediaFiles.matchStatus, 'matched'));
	return {
		films: Number(films?.value ?? 0),
		episodes: Number(episodes?.episodes ?? 0),
		shows: Number(episodes?.shows ?? 0),
		unmatched: Number(unmatched?.value ?? 0)
	};
}

/** A poster for the library rails, with the best local copy's quality. */
export interface LocalPosterItem extends PosterItem {
	resolution: Resolution;
	hdr: HdrKind;
	/** When the newest local file of this title was first indexed (ISO). */
	addedAt: string;
}

function bestQuality(rows: MediaFileRow[]): { resolution: Resolution; hdr: HdrKind } {
	const best = [...rows].sort(compareBest)[0];
	return {
		resolution: resolutionOf(best?.video ?? null),
		hdr: (best?.video?.hdr ?? 'sdr') as HdrKind
	};
}

function iso(value: unknown): string {
	const date = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

/** Standard films with at least one local file, newest additions first. */
export async function listLocalMovies(limit = 24, offset = 0): Promise<LocalPosterItem[]> {
	const addedAt = sql<Date>`max(${mediaFiles.createdAt})`;
	const firstGenre = sql<string | null>`(select ${genres.name} from ${movieGenres}
		inner join ${genres} on ${genres.id} = ${movieGenres.genreId}
		where ${movieGenres.movieId} = ${movies.id} limit 1)`;
	const page = await db
		.select({
			id: movies.id,
			title: movies.title,
			posterPath: movies.posterPath,
			releaseDate: movies.releaseDate,
			rating: movies.voteAverage,
			genre: firstGenre,
			addedAt
		})
		.from(movies)
		.innerJoin(
			mediaFiles,
			and(eq(mediaFiles.movieId, movies.id), eq(mediaFiles.matchStatus, 'matched'))
		)
		.where(standardMovieVisibilityWhere())
		.groupBy(movies.id)
		.orderBy(desc(addedAt), asc(movies.title), asc(movies.id))
		.limit(pageSize(limit))
		.offset(pageOffset(offset));
	if (page.length === 0) return [];

	const files = await db
		.select()
		.from(mediaFiles)
		.where(
			and(
				inArray(
					mediaFiles.movieId,
					page.map((row) => row.id)
				),
				eq(mediaFiles.matchStatus, 'matched')
			)
		);
	return page.map((row) => ({
		id: row.id,
		href: `/movies/${row.id}`,
		title: row.title,
		posterPath: row.posterPath ?? null,
		releaseDate: row.releaseDate ?? null,
		rating: row.rating ?? null,
		genre: row.genre ?? null,
		...bestQuality(files.filter((file) => file.movieId === row.id)),
		addedAt: iso(row.addedAt)
	}));
}

/** Standard shows with at least one local episode file, newest additions first. */
export async function listLocalShows(
	limit = 24,
	offset = 0
): Promise<Array<LocalPosterItem & { episodeCount: number }>> {
	const addedAt = sql<Date>`max(${mediaFiles.createdAt})`;
	const firstGenre = sql<string | null>`(select ${genres.name} from ${tvGenres}
		inner join ${genres} on ${genres.id} = ${tvGenres.genreId}
		where ${tvGenres.showId} = ${tvShows.id} limit 1)`;
	const page = await db
		.select({
			id: tvShows.id,
			tmdbId: tvShows.tmdbId,
			name: tvShows.name,
			posterPath: tvShows.posterPath,
			firstAirDate: tvShows.firstAirDate,
			rating: tvShows.voteAverage,
			genre: firstGenre,
			episodeCount: countDistinct(tvEpisodes.id),
			addedAt
		})
		.from(tvShows)
		.innerJoin(tvEpisodes, eq(tvEpisodes.showId, tvShows.id))
		.innerJoin(
			mediaFiles,
			and(eq(mediaFiles.episodeId, tvEpisodes.id), eq(mediaFiles.matchStatus, 'matched'))
		)
		.where(standardTvShowVisibilityWhere())
		.groupBy(tvShows.id)
		.orderBy(desc(addedAt), asc(tvShows.name), asc(tvShows.id))
		.limit(pageSize(limit))
		.offset(pageOffset(offset));
	if (page.length === 0) return [];

	const files = await db
		.select({ ...getTableColumns(mediaFiles), showId: tvEpisodes.showId })
		.from(mediaFiles)
		.innerJoin(tvEpisodes, eq(tvEpisodes.id, mediaFiles.episodeId))
		.where(
			and(
				inArray(
					tvEpisodes.showId,
					page.map((row) => row.id)
				),
				eq(mediaFiles.matchStatus, 'matched')
			)
		);
	return page.map((row) => ({
		id: row.id,
		href: `/tv/${row.tmdbId}`,
		title: row.name,
		posterPath: row.posterPath ?? null,
		releaseDate: row.firstAirDate ?? null,
		rating: row.rating ?? null,
		genre: row.genre ?? null,
		...bestQuality(files.filter((file) => file.showId === row.id)),
		addedAt: iso(row.addedAt),
		episodeCount: Number(row.episodeCount)
	}));
}

/** True when a position counts as watched: 92% of the duration, or the last 3 minutes. */
export function isCompletedPosition(
	positionSeconds: number,
	durationSeconds: number | null
): boolean {
	if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0)
		return false;
	if (!Number.isFinite(positionSeconds) || positionSeconds <= 0) return false;
	return (
		positionSeconds >= durationSeconds * COMPLETED_RATIO ||
		durationSeconds - positionSeconds <= COMPLETED_TAIL_SECONDS
	);
}

function toProgress(row: typeof mediaProgress.$inferSelect): ProgressEntry {
	return {
		fileId: row.fileId,
		positionSeconds: row.positionSeconds,
		durationSeconds: row.durationSeconds ?? null,
		completed: row.completed,
		updatedAt: iso(row.updatedAt)
	};
}

/** Saved positions of one user for the given files (unknown ids are ignored). */
export async function getProgress(userId: string, fileIds: string[]): Promise<ProgressEntry[]> {
	const ids = uuids(Array.isArray(fileIds) ? fileIds : [], 200);
	if (!isUuid(userId) || ids.length === 0) return [];
	const rows = await db
		.select()
		.from(mediaProgress)
		.where(and(eq(mediaProgress.userId, userId), inArray(mediaProgress.fileId, ids)));
	return rows.map(toProgress);
}

export interface ProgressInput {
	fileId: string;
	positionSeconds: number;
	durationSeconds: number | null;
}

function isForeignKeyViolation(error: unknown): boolean {
	const code = (value: unknown) => (value as { code?: unknown } | null)?.code;
	return code(error) === '23503' || code((error as { cause?: unknown } | null)?.cause) === '23503';
}

/**
 * Upserts one position (the caller rate-limits writes). Null for invalid input or an unknown
 * file/user. The position is clamped to the duration; `completed` follows {@link isCompletedPosition}.
 */
export async function saveProgress(
	userId: string,
	entry: ProgressInput
): Promise<ProgressEntry | null> {
	if (!isUuid(userId) || !entry || !isUuid(entry.fileId)) return null;
	const duration =
		typeof entry.durationSeconds === 'number' &&
		Number.isFinite(entry.durationSeconds) &&
		entry.durationSeconds > 0
			? entry.durationSeconds
			: null;
	if (typeof entry.positionSeconds !== 'number' || !Number.isFinite(entry.positionSeconds))
		return null;
	if (entry.positionSeconds < 0) return null;
	const position =
		duration === null ? entry.positionSeconds : Math.min(entry.positionSeconds, duration);
	const values = {
		positionSeconds: position,
		durationSeconds: duration,
		completed: isCompletedPosition(position, duration),
		updatedAt: sql`now()`
	};
	try {
		const [row] = await db
			.insert(mediaProgress)
			.values({ userId, fileId: entry.fileId, ...values })
			.onConflictDoUpdate({ target: [mediaProgress.userId, mediaProgress.fileId], set: values })
			.returning();
		return row ? toProgress(row) : null;
	} catch (error) {
		if (isForeignKeyViolation(error)) return null;
		throw error;
	}
}

function episodeLabel(season: number, episode: number): string {
	return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
}

export interface EpisodeRef {
	id: string;
	showId: string;
	showTmdbId: number;
	showName: string;
	seasonNumber: number;
	episodeNumber: number;
	label: string; // S01E02
	name: string | null;
	stillPath: string | null;
}

export interface ContinueWatchingRow {
	fileId: string;
	positionSeconds: number;
	durationSeconds: number | null;
	updatedAt: string;
	kind: 'movie' | 'episode';
	/** Film title or show name. */
	title: string;
	/** "S01E02 · Episode name" for an episode, the release year for a film. */
	subtitle: string | null;
	href: string;
	/** Best landscape image: episode still, else backdrop, else poster. */
	imagePath: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	movie: { id: string; tmdbId: number; title: string; releaseDate: string | null } | null;
	episode: EpisodeRef | null;
}

/**
 * Unfinished titles of one user for a rail, newest first: one row per film and one per show (its
 * most recently watched episode). Standard content only; finished and untouched files are left out.
 */
export async function listContinueWatching(
	userId: string,
	limit = 12
): Promise<ContinueWatchingRow[]> {
	if (!isUuid(userId)) return [];
	const size = pageSize(limit, MAX_CONTINUE);
	const rows = await db
		.select({
			fileId: mediaProgress.fileId,
			positionSeconds: mediaProgress.positionSeconds,
			durationSeconds: mediaProgress.durationSeconds,
			updatedAt: mediaProgress.updatedAt,
			movieId: movies.id,
			movieTmdbId: movies.tmdbId,
			movieTitle: movies.title,
			moviePoster: movies.posterPath,
			movieBackdrop: movies.backdropPath,
			movieRelease: movies.releaseDate,
			episodeId: tvEpisodes.id,
			seasonNumber: tvEpisodes.seasonNumber,
			episodeNumber: tvEpisodes.episodeNumber,
			episodeName: tvEpisodes.name,
			stillPath: tvEpisodes.stillPath,
			showId: tvShows.id,
			showTmdbId: tvShows.tmdbId,
			showName: tvShows.name,
			showPoster: tvShows.posterPath,
			showBackdrop: tvShows.backdropPath
		})
		.from(mediaProgress)
		.innerJoin(mediaFiles, eq(mediaFiles.id, mediaProgress.fileId))
		.leftJoin(movies, eq(movies.id, mediaFiles.movieId))
		.leftJoin(tvEpisodes, eq(tvEpisodes.id, mediaFiles.episodeId))
		.leftJoin(tvShows, eq(tvShows.id, tvEpisodes.showId))
		.where(
			and(
				eq(mediaProgress.userId, userId),
				eq(mediaProgress.completed, false),
				gt(mediaProgress.positionSeconds, 0),
				eq(mediaFiles.matchStatus, 'matched'),
				or(
					and(isNotNull(mediaFiles.movieId), standardMovieVisibilityWhere()),
					and(isNotNull(mediaFiles.episodeId), standardTvShowVisibilityWhere())
				)
			)
		)
		.orderBy(desc(mediaProgress.updatedAt), asc(mediaProgress.fileId))
		.limit(Math.min(size * 4, 200));

	const seen = new Set<string>();
	const result: ContinueWatchingRow[] = [];
	for (const row of rows) {
		const key = row.movieId ? `movie:${row.movieId}` : `show:${row.showId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const base = {
			fileId: row.fileId,
			positionSeconds: row.positionSeconds,
			durationSeconds: row.durationSeconds ?? null,
			updatedAt: iso(row.updatedAt)
		};
		if (row.movieId) {
			result.push({
				...base,
				kind: 'movie',
				title: row.movieTitle ?? '',
				subtitle: row.movieRelease ? row.movieRelease.slice(0, 4) : null,
				href: `/movies/${row.movieId}`,
				imagePath: row.movieBackdrop ?? row.moviePoster ?? null,
				posterPath: row.moviePoster ?? null,
				backdropPath: row.movieBackdrop ?? null,
				movie: {
					id: row.movieId,
					tmdbId: row.movieTmdbId ?? 0,
					title: row.movieTitle ?? '',
					releaseDate: row.movieRelease ?? null
				},
				episode: null
			});
		} else if (row.episodeId && row.showId) {
			const label = episodeLabel(row.seasonNumber ?? 0, row.episodeNumber ?? 0);
			result.push({
				...base,
				kind: 'episode',
				title: row.showName ?? '',
				subtitle: row.episodeName ? `${label} · ${row.episodeName}` : label,
				href: `/tv/${row.showTmdbId}`,
				imagePath: row.stillPath ?? row.showBackdrop ?? row.showPoster ?? null,
				posterPath: row.showPoster ?? null,
				backdropPath: row.showBackdrop ?? null,
				movie: null,
				episode: {
					id: row.episodeId,
					showId: row.showId,
					showTmdbId: row.showTmdbId ?? 0,
					showName: row.showName ?? '',
					seasonNumber: row.seasonNumber ?? 0,
					episodeNumber: row.episodeNumber ?? 0,
					label,
					name: row.episodeName ?? null,
					stillPath: row.stillPath ?? null
				}
			});
		}
		if (result.length >= size) break;
	}
	return result;
}

/**
 * The next episode of the same (standard) show that has a local file, with its best file: S01E10
 * leads to S02E01, missing episodes are skipped, specials (season 0) only follow specials.
 */
export async function nextEpisodeFile(
	fileId: string
): Promise<{ fileId: string; episode: EpisodeRef } | null> {
	if (!isUuid(fileId)) return null;
	const [current] = await db
		.select({
			showId: tvEpisodes.showId,
			seasonNumber: tvEpisodes.seasonNumber,
			episodeNumber: tvEpisodes.episodeNumber
		})
		.from(mediaFiles)
		.innerJoin(tvEpisodes, eq(tvEpisodes.id, mediaFiles.episodeId))
		.innerJoin(tvShows, eq(tvShows.id, tvEpisodes.showId))
		.where(and(eq(mediaFiles.id, fileId), standardTvShowVisibilityWhere()))
		.limit(1);
	if (!current) return null;

	const seasonScope =
		current.seasonNumber === 0 ? eq(tvEpisodes.seasonNumber, 0) : gt(tvEpisodes.seasonNumber, 0);
	const [next] = await db
		.select({
			id: tvEpisodes.id,
			showId: tvShows.id,
			showTmdbId: tvShows.tmdbId,
			showName: tvShows.name,
			seasonNumber: tvEpisodes.seasonNumber,
			episodeNumber: tvEpisodes.episodeNumber,
			name: tvEpisodes.name,
			stillPath: tvEpisodes.stillPath
		})
		.from(tvEpisodes)
		.innerJoin(tvShows, eq(tvShows.id, tvEpisodes.showId))
		.where(
			and(
				eq(tvEpisodes.showId, current.showId),
				seasonScope,
				sql`(${tvEpisodes.seasonNumber}, ${tvEpisodes.episodeNumber}) > (${current.seasonNumber}, ${current.episodeNumber})`,
				sql`exists (select 1 from ${mediaFiles} where ${mediaFiles.episodeId} = ${tvEpisodes.id} and ${mediaFiles.matchStatus} = 'matched')`,
				standardTvShowVisibilityWhere()
			)
		)
		.orderBy(asc(tvEpisodes.seasonNumber), asc(tvEpisodes.episodeNumber))
		.limit(1);
	if (!next) return null;

	const best = (await getPlayableForEpisodes([next.id])).get(next.id)?.[0];
	if (!best) return null;
	return {
		fileId: best.fileId,
		episode: {
			id: next.id,
			showId: next.showId,
			showTmdbId: next.showTmdbId,
			showName: next.showName,
			seasonNumber: next.seasonNumber,
			episodeNumber: next.episodeNumber,
			label: episodeLabel(next.seasonNumber, next.episodeNumber),
			name: next.name ?? null,
			stillPath: next.stillPath ?? null
		}
	};
}
