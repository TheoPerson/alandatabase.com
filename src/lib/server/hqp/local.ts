import type { PlayableFile, ProgressEntry } from '$lib/media/types';
import {
	getMediaFile,
	getPlayableForEpisodes,
	getPlayableForMovie,
	getProgress
} from '$lib/server/media/repository';
import { progressFraction, qualityLine, remainingLabel } from './labels';

/**
 * Owner-only "on this PC" data for the title pages: which local copy Play opens, the Resume
 * state from server progress (shared across devices), the quality line and the Versions menu.
 * Callers check isOwnerUser first; for anyone else they never call these functions.
 */

const PROGRESS_BATCH = 200;
const MAX_VERSIONS = 6;

export interface LocalPlayAction {
	fileId: string;
	href: string; // /watch/<fileId>
	label: string; // "Play", "Resume · 41 min left", "Play S5 E1", "Resume S5 E2 · 12 min left"
	progress: number; // watched fraction 0..1 (0 = not started)
	startOverHref: string | null; // /watch/<fileId>?t=0 while resuming
}

export interface LocalVersion {
	fileId: string;
	href: string;
	label: string;
	best: boolean;
}

export interface LocalFilm {
	files: PlayableFile[];
	progress: ProgressEntry | null;
	play: LocalPlayAction;
	quality: string;
	versions: LocalVersion[];
}

export interface LocalEpisodeRow {
	fileId: string;
	episodeNumber: number;
	title: string;
	stillPath: string | null;
	runtimeMinutes: number | null;
	progress: number;
	completed: boolean;
	href: string;
	remainingLabel: string | null; // set while partly watched
	resolution: PlayableFile['resolution'];
}

export interface LocalShow {
	seasons: Array<{ seasonNumber: number; episodes: LocalEpisodeRow[] }>;
	resume: { fileId: string; label: string } | null;
	play: LocalPlayAction | null;
	episodeCount: number;
}

/** The episode fields the series page already has (from tv-db.service). */
export interface EpisodeSource {
	id: string;
	seasonNumber: number;
	episodeNumber: number;
	name: string | null;
	stillPath: string | null;
	runtime: number | null;
}

async function progressMap(userId: string, fileIds: string[]): Promise<Map<string, ProgressEntry>> {
	const entries: ProgressEntry[] = [];
	for (let start = 0; start < fileIds.length; start += PROGRESS_BATCH) {
		entries.push(...(await getProgress(userId, fileIds.slice(start, start + PROGRESS_BATCH))));
	}
	return new Map(entries.map((entry) => [entry.fileId, entry]));
}

function isUnfinished(entry: ProgressEntry | null | undefined): entry is ProgressEntry {
	return Boolean(entry && !entry.completed && entry.positionSeconds > 0);
}

function newest(entries: ProgressEntry[]): ProgressEntry | null {
	return (
		[...entries].sort(
			(a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.fileId.localeCompare(b.fileId)
		)[0] ?? null
	);
}

function watchHref(fileId: string): string {
	return `/watch/${fileId}`;
}

function playAction(
	fileId: string,
	entry: ProgressEntry | null,
	file: PlayableFile | undefined,
	what: string | null
): LocalPlayAction {
	if (isUnfinished(entry)) {
		const duration = entry.durationSeconds ?? file?.durationSeconds ?? null;
		const left = remainingLabel(entry.positionSeconds, duration);
		return {
			fileId,
			href: watchHref(fileId),
			label: [what ? `Resume ${what}` : 'Resume', left].filter(Boolean).join(' · '),
			progress: progressFraction(entry.positionSeconds, duration),
			startOverHref: `${watchHref(fileId)}?t=0`
		};
	}
	return {
		fileId,
		href: watchHref(fileId),
		label: what ? `Play ${what}` : 'Play',
		progress: 0,
		startOverHref: null
	};
}

/** The film's local copies for the owner, or null when none is on this PC. */
export async function getLocalFilm(userId: string, movieId: string): Promise<LocalFilm | null> {
	const files = await getPlayableForMovie(movieId);
	if (files.length === 0) return null;
	const listed = files.slice(0, MAX_VERSIONS);
	const [progress, records] = await Promise.all([
		progressMap(
			userId,
			files.map((file) => file.fileId)
		),
		Promise.all(listed.map((file) => getMediaFile(file.fileId)))
	]);
	const latest = newest([...progress.values()]);
	// Resume the copy that was being watched; otherwise Play opens the best copy.
	const target =
		isUnfinished(latest) && files.some((file) => file.fileId === latest.fileId)
			? latest.fileId
			: files[0].fileId;
	const labels = listed.map((file, index) => qualityLine(file, records[index]?.audioTracks));
	return {
		files,
		progress: latest,
		play: playAction(
			target,
			latest?.fileId === target ? latest : null,
			files.find((file) => file.fileId === target),
			null
		),
		quality: labels[0] ?? '',
		versions: listed.map((file, index) => ({
			fileId: file.fileId,
			href: watchHref(file.fileId),
			label: labels[index] || `Version ${index + 1}`,
			best: index === 0
		}))
	};
}

function episodeWhat(season: number, episode: number): string {
	return season === 0 ? `Special ${episode}` : `S${season} E${episode}`;
}

/**
 * The owner's local episodes of a show grouped by season (regular seasons first, specials last),
 * and the series-level Play/Resume: the most recently watched unfinished episode, else the first
 * episode not completed, else the first one.
 */
export async function getLocalShow(
	userId: string,
	episodes: EpisodeSource[]
): Promise<LocalShow | null> {
	if (episodes.length === 0) return null;
	const files = await getPlayableForEpisodes(episodes.map((episode) => episode.id));
	if (files.size === 0) return null;
	const progress = await progressMap(
		userId,
		[...files.values()].flat().map((file) => file.fileId)
	);

	const ordered = [...episodes].sort(
		(a, b) =>
			Number(a.seasonNumber === 0) - Number(b.seasonNumber === 0) ||
			a.seasonNumber - b.seasonNumber ||
			a.episodeNumber - b.episodeNumber
	);
	const seasons = new Map<number, LocalEpisodeRow[]>();
	const rows: Array<{
		source: EpisodeSource;
		file: PlayableFile;
		row: LocalEpisodeRow;
		entry: ProgressEntry | null;
	}> = [];
	for (const source of ordered) {
		const candidates = files.get(source.id);
		if (!candidates || candidates.length === 0) continue;
		// The copy last watched keeps its place; otherwise the best copy plays.
		const watched = newest(
			candidates
				.map((file) => progress.get(file.fileId))
				.filter((entry): entry is ProgressEntry => Boolean(entry))
		);
		const file =
			candidates.find((candidate) => candidate.fileId === watched?.fileId) ?? candidates[0];
		const entry = progress.get(file.fileId) ?? null;
		const duration = entry?.durationSeconds ?? file.durationSeconds;
		const row: LocalEpisodeRow = {
			fileId: file.fileId,
			episodeNumber: source.episodeNumber,
			title: source.name ?? `Episode ${source.episodeNumber}`,
			stillPath: source.stillPath,
			runtimeMinutes: source.runtime,
			progress: entry?.completed
				? 1
				: entry
					? progressFraction(entry.positionSeconds, duration)
					: 0,
			completed: Boolean(entry?.completed),
			href: watchHref(file.fileId),
			remainingLabel: isUnfinished(entry) ? remainingLabel(entry.positionSeconds, duration) : null,
			resolution: file.resolution
		};
		rows.push({ source, file, row, entry });
		const list = seasons.get(source.seasonNumber) ?? [];
		list.push(row);
		seasons.set(source.seasonNumber, list);
	}
	if (rows.length === 0) return null;

	const unfinished = rows
		.filter(({ entry }) => isUnfinished(entry))
		.sort((a, b) => (b.entry?.updatedAt ?? '').localeCompare(a.entry?.updatedAt ?? ''))[0];
	const pick = unfinished ?? rows.find(({ row }) => !row.completed) ?? rows[0];
	const what = episodeWhat(pick.source.seasonNumber, pick.source.episodeNumber);
	const play = playAction(pick.row.fileId, pick.entry, pick.file, what);

	return {
		seasons: [...seasons].map(([seasonNumber, list]) => ({ seasonNumber, episodes: list })),
		resume: { fileId: play.fileId, label: play.label },
		play,
		episodeCount: rows.length
	};
}
