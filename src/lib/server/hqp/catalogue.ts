import { and, asc, desc, eq, gt, ne } from 'drizzle-orm';
import { db } from '../db';
import { mediaFiles, movies, tvEpisodes, tvShows } from '../db/schema';
import { standardMovieVisibilityWhere } from '../policies/movie-visibility';
import { standardTvShowVisibilityWhere } from '../policies/tv-visibility';
import { resolutionOf } from '../media/repository';
import type { PlayableFile } from '$lib/media/types';

/**
 * Read-only catalogue reads for Alan's HQP launch and the owner's library pages.
 *
 * - No authorization here: every caller checks the owner first (isOwnerUser).
 * - Films and shows follow the same standard-content predicates as their title pages, so a
 *   quarantined title is never playable from a link either.
 * - Nothing here selects a file path: rows carry ids and display fields only.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MAX_QUEUE_EPISODES = 400;
const MAX_UNMATCHED = 100;

function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID.test(value);
}

function text(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

export interface LaunchMovie {
	id: string;
	title: string;
	releaseDate: string | null;
	overview: string | null;
	runtime: number | null;
	originalLanguage: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	logoPath: string | null;
}

/** A standard film's display fields, or null (unknown, malformed or quarantined). */
export async function getLaunchMovie(movieId: string): Promise<LaunchMovie | null> {
	if (!isUuid(movieId)) return null;
	const [row] = await db
		.select({
			id: movies.id,
			title: movies.title,
			releaseDate: movies.releaseDate,
			overview: movies.overview,
			runtime: movies.runtime,
			originalLanguage: movies.originalLanguage,
			posterPath: movies.posterPath,
			backdropPath: movies.backdropPath,
			metadata: movies.metadata
		})
		.from(movies)
		.where(and(eq(movies.id, movieId), standardMovieVisibilityWhere()))
		.limit(1);
	if (!row) return null;
	const metadata =
		row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
			? (row.metadata as Record<string, unknown>)
			: {};
	return {
		id: row.id,
		title: row.title,
		releaseDate: text(row.releaseDate),
		overview: text(row.overview),
		runtime: typeof row.runtime === 'number' ? row.runtime : null,
		originalLanguage: text(row.originalLanguage),
		posterPath: text(row.posterPath),
		backdropPath: text(row.backdropPath),
		logoPath: text(metadata.logoPath)
	};
}

export interface LaunchShow {
	id: string;
	tmdbId: number;
	name: string;
	firstAirDate: string | null;
	originalLanguage: string | null;
	posterPath: string | null;
	backdropPath: string | null;
}

export interface LaunchEpisode {
	id: string;
	seasonNumber: number;
	episodeNumber: number;
	name: string | null;
	overview: string | null;
	stillPath: string | null;
	airDate: string | null;
	runtime: number | null;
}

/**
 * The standard show an episode belongs to, with the episodes that can follow it in a queue,
 * ordered by (season, episode): regular seasons for a regular episode, specials (season 0) for a
 * special, the same rule as the repository's next-episode lookup.
 */
export async function getLaunchShowForEpisode(
	episodeId: string
): Promise<{ show: LaunchShow; episode: LaunchEpisode; episodes: LaunchEpisode[] } | null> {
	if (!isUuid(episodeId)) return null;
	const [current] = await db
		.select({
			showId: tvShows.id,
			tmdbId: tvShows.tmdbId,
			name: tvShows.name,
			firstAirDate: tvShows.firstAirDate,
			originalLanguage: tvShows.originalLanguage,
			posterPath: tvShows.posterPath,
			backdropPath: tvShows.backdropPath,
			seasonNumber: tvEpisodes.seasonNumber
		})
		.from(tvEpisodes)
		.innerJoin(tvShows, eq(tvShows.id, tvEpisodes.showId))
		.where(and(eq(tvEpisodes.id, episodeId), standardTvShowVisibilityWhere()))
		.limit(1);
	if (!current) return null;

	const seasonScope =
		current.seasonNumber === 0 ? eq(tvEpisodes.seasonNumber, 0) : gt(tvEpisodes.seasonNumber, 0);
	const rows = await db
		.select({
			id: tvEpisodes.id,
			seasonNumber: tvEpisodes.seasonNumber,
			episodeNumber: tvEpisodes.episodeNumber,
			name: tvEpisodes.name,
			overview: tvEpisodes.overview,
			stillPath: tvEpisodes.stillPath,
			airDate: tvEpisodes.airDate,
			runtime: tvEpisodes.runtime
		})
		.from(tvEpisodes)
		.where(and(eq(tvEpisodes.showId, current.showId), seasonScope))
		.orderBy(asc(tvEpisodes.seasonNumber), asc(tvEpisodes.episodeNumber))
		.limit(MAX_QUEUE_EPISODES);

	const episodes: LaunchEpisode[] = rows.map((row) => ({
		id: row.id,
		seasonNumber: row.seasonNumber,
		episodeNumber: row.episodeNumber,
		name: text(row.name),
		overview: text(row.overview),
		stillPath: text(row.stillPath),
		airDate: text(row.airDate),
		runtime: typeof row.runtime === 'number' ? row.runtime : null
	}));
	const episode = episodes.find((entry) => entry.id === episodeId);
	if (!episode) return null;
	return {
		show: {
			id: current.showId,
			tmdbId: current.tmdbId,
			name: current.name,
			firstAirDate: text(current.firstAirDate),
			originalLanguage: text(current.originalLanguage),
			posterPath: text(current.posterPath),
			backdropPath: text(current.backdropPath)
		},
		episode,
		episodes
	};
}

export interface ParsedTitle {
	title: string;
	year: number | null;
}

/** The title the scanner parsed from a file name (unmatched files are named by it). */
export async function getParsedTitle(fileId: string): Promise<ParsedTitle | null> {
	if (!isUuid(fileId)) return null;
	const [row] = await db
		.select({ parsed: mediaFiles.parsed })
		.from(mediaFiles)
		.where(eq(mediaFiles.id, fileId))
		.limit(1);
	const parsed = row?.parsed;
	if (!parsed || typeof parsed !== 'object') return null;
	const title = text(parsed.title)?.trim();
	if (!title) return null;
	return { title, year: Number.isInteger(parsed.year) ? (parsed.year as number) : null };
}

export interface UnmatchedFile {
	fileId: string;
	title: string;
	year: number | null;
	durationSeconds: number | null;
	resolution: PlayableFile['resolution'];
}

/** Files the scanner could not link to a film or an episode, by parsed title (bounded). */
export async function listUnmatchedFiles(limit = MAX_UNMATCHED): Promise<UnmatchedFile[]> {
	const size = Number.isFinite(limit)
		? Math.min(Math.max(Math.trunc(limit), 1), MAX_UNMATCHED)
		: MAX_UNMATCHED;
	const rows = await db
		.select({
			id: mediaFiles.id,
			parsed: mediaFiles.parsed,
			durationSeconds: mediaFiles.durationSeconds,
			video: mediaFiles.video,
			createdAt: mediaFiles.createdAt
		})
		.from(mediaFiles)
		.where(ne(mediaFiles.matchStatus, 'matched'))
		.orderBy(desc(mediaFiles.createdAt), asc(mediaFiles.id))
		.limit(size);
	return rows
		.map((row) => {
			const parsed = row.parsed && typeof row.parsed === 'object' ? row.parsed : null;
			const title = text(parsed?.title)?.trim() || 'Untitled file';
			return {
				fileId: row.id,
				title,
				year: parsed && Number.isInteger(parsed.year) ? (parsed.year as number) : null,
				durationSeconds: typeof row.durationSeconds === 'number' ? row.durationSeconds : null,
				resolution: resolutionOf(row.video ?? null)
			};
		})
		.sort((a, b) => a.title.localeCompare(b.title, 'en') || a.fileId.localeCompare(b.fileId));
}
