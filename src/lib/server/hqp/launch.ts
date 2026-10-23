import type { MediaFileRecord, PlayableFile, ProgressEntry } from '$lib/media/types';
import type { HqpItem, HqpLaunchPayload } from '$lib/player/hqp/types';
import type { ContinueCardItem } from '$lib/components/ui/continue-card/types';
import {
	getMediaFile,
	getPlayableForEpisodes,
	getPlayableForMovie,
	getProgress,
	resolutionOf,
	type ContinueWatchingRow
} from '$lib/server/media/repository';
import { getLaunchMovie, getLaunchShowForEpisode, getParsedTitle } from './catalogue';
import { progressFraction, remainingLabel, remainingSpoken } from './labels';

export type { ContinueCardItem };

/**
 * What /watch/<fileId> hands to Alan's HQP: the queue to play, which item, and where Close goes.
 * Owner only (the caller checks isOwnerUser). Read-only: no session is started here, so a hover
 * preload of the watch page has no side effect. The payload carries ids and display fields only,
 * never a library path or a codec.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const PROGRESS_BATCH = 200;
const MAX_START_SECONDS = 86_400;
const UNMATCHED_HREF = '/my/films?tab=local';

function yearOf(date: string | null | undefined): number | null {
	const match = /^(\d{4})/u.exec(date ?? '');
	return match ? Number(match[1]) : null;
}

/** The ids-only view of a file record (the same shape the repository gives for matched files). */
function toPlayableFile(record: MediaFileRecord): PlayableFile {
	return {
		fileId: record.id,
		durationSeconds: record.durationSeconds ?? null,
		resolution: resolutionOf(record.video),
		hdr: record.video?.hdr ?? 'sdr',
		audio: record.audioTracks.map((track) => ({
			ordinal: track.ordinal,
			language: track.language ?? null,
			title: track.title ?? null,
			channels: track.channels ?? null
		})),
		subtitles: record.subtitleTracks.map((track) => ({
			ordinal: track.ordinal,
			language: track.language ?? null,
			title: track.title ?? null,
			forced: track.forced === true,
			isText: track.isText === true
		}))
	};
}

async function progressFor(userId: string, fileIds: string[]): Promise<Map<string, ProgressEntry>> {
	const entries: ProgressEntry[] = [];
	for (let start = 0; start < fileIds.length; start += PROGRESS_BATCH) {
		entries.push(...(await getProgress(userId, fileIds.slice(start, start + PROGRESS_BATCH))));
	}
	return new Map(entries.map((entry) => [entry.fileId, entry]));
}

async function withProgress(
	userId: string,
	items: Array<Omit<HqpItem, 'progress'>>,
	index: number
): Promise<HqpLaunchPayload> {
	const progress = await progressFor(
		userId,
		items.map((item) => item.fileId)
	);
	const queue = items.map((item) => ({ ...item, progress: progress.get(item.fileId) ?? null }));
	return { queue, index, returnHref: queue[index].titleHref };
}

async function filmPayload(
	userId: string,
	record: MediaFileRecord,
	movieId: string
): Promise<HqpLaunchPayload | null> {
	const [movie, files] = await Promise.all([getLaunchMovie(movieId), getPlayableForMovie(movieId)]);
	const file = files.find((entry) => entry.fileId === record.id);
	if (!movie || !file) return null;
	return withProgress(
		userId,
		[
			{
				fileId: file.fileId,
				kind: 'movie',
				title: movie.title,
				showTitle: null,
				seasonNumber: null,
				episodeNumber: null,
				overview: movie.overview,
				year: yearOf(movie.releaseDate),
				runtimeMinutes: movie.runtime,
				originalLanguage: movie.originalLanguage,
				artwork: {
					stillPath: movie.backdropPath,
					backdropPath: movie.backdropPath,
					posterPath: movie.posterPath,
					logoPath: movie.logoPath
				},
				titleHref: `/movies/${movie.id}`,
				file
			}
		],
		0
	);
}

async function episodePayload(
	userId: string,
	record: MediaFileRecord,
	episodeId: string
): Promise<HqpLaunchPayload | null> {
	const context = await getLaunchShowForEpisode(episodeId);
	if (!context) return null;
	const { show, episodes } = context;
	const files = await getPlayableForEpisodes(episodes.map((entry) => entry.id));

	const items: Array<Omit<HqpItem, 'progress'>> = [];
	let index = -1;
	for (const entry of episodes) {
		const candidates = files.get(entry.id) ?? [];
		const isRequested = entry.id === episodeId;
		const file = isRequested
			? candidates.find((candidate) => candidate.fileId === record.id)
			: candidates[0];
		if (!file) {
			if (isRequested) return null;
			continue;
		}
		if (isRequested) index = items.length;
		items.push({
			fileId: file.fileId,
			kind: 'episode',
			title: entry.name ?? `Episode ${entry.episodeNumber}`,
			showTitle: show.name,
			seasonNumber: entry.seasonNumber,
			episodeNumber: entry.episodeNumber,
			overview: entry.overview,
			year: yearOf(entry.airDate) ?? yearOf(show.firstAirDate),
			runtimeMinutes: entry.runtime,
			originalLanguage: show.originalLanguage,
			artwork: {
				stillPath: entry.stillPath ?? show.backdropPath,
				backdropPath: show.backdropPath,
				posterPath: show.posterPath,
				logoPath: null
			},
			titleHref: `/tv/${show.tmdbId}?season=${entry.seasonNumber}`,
			file
		});
	}
	if (index < 0) return null;
	return withProgress(userId, items, index);
}

async function unmatchedPayload(
	userId: string,
	record: MediaFileRecord
): Promise<HqpLaunchPayload> {
	const parsed = await getParsedTitle(record.id);
	return withProgress(
		userId,
		[
			{
				fileId: record.id,
				kind: 'movie',
				title: parsed?.title ?? 'Untitled file',
				showTitle: null,
				seasonNumber: null,
				episodeNumber: null,
				overview: null,
				year: parsed?.year ?? null,
				runtimeMinutes: null,
				originalLanguage: null,
				artwork: { stillPath: null, backdropPath: null, posterPath: null, logoPath: null },
				titleHref: UNMATCHED_HREF,
				file: toPlayableFile(record)
			}
		],
		0
	);
}

/** The launch payload for one file, or null when it is unknown, malformed or not visible. */
export async function buildLaunchPayload(
	userId: string,
	fileId: string
): Promise<HqpLaunchPayload | null> {
	if (!UUID.test(fileId)) return null;
	const record = await getMediaFile(fileId);
	if (!record) return null;
	if (record.matchStatus === 'matched' && record.movieId)
		return filmPayload(userId, record, record.movieId);
	if (record.matchStatus === 'matched' && record.episodeId)
		return episodePayload(userId, record, record.episodeId);
	return unmatchedPayload(userId, record);
}

/** `?t=` on /watch: whole seconds 0..86400 start there; anything else resumes. */
export function parseStartAt(value: string | null): number | 'resume' {
	if (value === null || !/^\d{1,5}$/u.test(value)) return 'resume';
	const seconds = Number(value);
	return seconds <= MAX_START_SECONDS ? seconds : 'resume';
}

/** A Continue watching rail card from a repository row. */
export function toContinueCardItem(row: ContinueWatchingRow): ContinueCardItem {
	const left = remainingLabel(row.positionSeconds, row.durationSeconds);
	const spoken = remainingSpoken(row.positionSeconds, row.durationSeconds);
	let eyebrow: string;
	let spokenContext: string | null;
	if (row.kind === 'episode' && row.episode) {
		const { seasonNumber, episodeNumber, name } = row.episode;
		eyebrow = [`S${seasonNumber}`, `E${episodeNumber}`, name].filter(Boolean).join(' · ');
		spokenContext = [`season ${seasonNumber} episode ${episodeNumber}`, name]
			.filter(Boolean)
			.join(', ');
	} else {
		eyebrow = row.subtitle ?? 'Film';
		spokenContext = null;
	}
	return {
		fileId: row.fileId,
		href: `/watch/${row.fileId}`,
		title: row.title,
		eyebrow,
		stillPath: row.imagePath,
		progress: progressFraction(row.positionSeconds, row.durationSeconds),
		remainingLabel: left ?? 'Resume',
		ariaLabel: ['Resume ' + row.title, spokenContext, spoken].filter(Boolean).join(', ')
	};
}
