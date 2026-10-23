// The media runtime behind /api/media: configuration, ffmpeg support, playback sessions and the
// background services, created once per server process. Also the session start sequence.

import { stat } from 'node:fs/promises';
import type {
	ClientCaps,
	MediaFileRecord,
	PlaybackSession,
	QualityLevel,
	StartSessionRequest
} from '$lib/media/types';
import { BackgroundQueue } from './background';
import { ffmpegSupport, type FfmpegSupport } from './capabilities';
import { ChapterService } from './chapters';
import { readMediaConfig, type MediaConfig } from './config';
import { KeyframeIndexer } from './indexer';
import {
	planKeyframeSegments,
	planUniformSegments,
	segmentAt,
	TARGET_SEGMENT_SECONDS,
	type FileIdentity
} from './keyframes';
import { audioLabels, subtitleLabels } from './labels';
import { cacheDirConflicts, resolveInsideRoots } from './paths';
import { spawnTracked } from './process';
import { ProgressWriter } from './progress-writer';
import { getMediaFile, saveProgress } from './repository';
import { MediaSessionManager, type RunProcess } from './session-manager';
import { availableQualities, chooseStreamPlan, clientDecodes, sourceTransfer } from './stream-plan';
import { SubtitleService } from './subtitles';
import { TrickplayService } from './trickplay';

export class MediaHttpError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

export interface MediaRuntime {
	config: MediaConfig;
	support: FfmpegSupport;
	queue: BackgroundQueue;
	sessions: MediaSessionManager;
	indexer: KeyframeIndexer;
	subtitles: SubtitleService;
	chapters: ChapterService;
	trickplay: TrickplayService;
}

const GLOBAL_KEY = Symbol.for('alandb.media.runtime');
type Holder = { key: string; runtime: MediaRuntime };
const globals = globalThis as unknown as Record<symbol, Holder | undefined>;

// The cache-folder check resolves junctions on disk: once per configuration.
const cacheChecks = new Map<string, boolean>();

/** Library configuration, or the 503 explaining why media is unavailable. */
export function mediaConfig(env: Record<string, string | undefined> = process.env): MediaConfig {
	const config = readMediaConfig(env);
	if (!config) throw new MediaHttpError(503, 'Media streaming is not configured on this server');
	const key = JSON.stringify([config.cacheDir, config.roots]);
	let conflict = cacheChecks.get(key);
	if (conflict === undefined) {
		conflict = cacheDirConflicts(config.cacheDir, config.roots);
		cacheChecks.set(key, conflict);
	}
	if (conflict) {
		throw new MediaHttpError(503, 'MEDIA_CACHE_DIR must be outside the media library');
	}
	return config;
}

/** The process-wide runtime (sessions survive dev-server module reloads). */
export async function mediaRuntime(
	env: Record<string, string | undefined> = process.env
): Promise<MediaRuntime> {
	const config = mediaConfig(env);
	const support = await ffmpegSupport(config.ffmpegPath);
	if (!support.available) throw new MediaHttpError(503, 'ffmpeg is not available on this server');
	const key = JSON.stringify(config);
	const existing = globals[GLOBAL_KEY];
	if (existing?.key === key) return existing.runtime;
	existing?.runtime.sessions.shutdown();

	// Every whole-file job (subtitles, trickplay, keyframe scans) runs one at a time, starts only
	// while no session needs the library disk, paces its reads the same way, and stops once the
	// owner has left the file.
	const queue = new BackgroundQueue();
	const sessions = new MediaSessionManager({
		cacheDir: config.cacheDir,
		spawn: (args) => spawnTracked(config.ffmpegPath, args) as unknown as RunProcess,
		onRemoved: (fileId) => queue.cancelFile(fileId)
	});
	const gate = () => !sessions.busy();
	queue.setGate(gate);
	sessions.startSweeper();
	process.once('exit', () => sessions.shutdown());
	const runtime: MediaRuntime = {
		config,
		support,
		queue,
		sessions,
		indexer: new KeyframeIndexer({
			cacheDir: config.cacheDir,
			ffprobePath: config.ffprobePath,
			queue
		}),
		subtitles: new SubtitleService({
			cacheDir: config.cacheDir,
			ffmpegPath: config.ffmpegPath,
			queue,
			gate
		}),
		chapters: new ChapterService(config.ffprobePath),
		trickplay: new TrickplayService({
			cacheDir: config.cacheDir,
			ffmpegPath: config.ffmpegPath,
			queue,
			gpu: support.cuda,
			gate
		})
	};
	globals[GLOBAL_KEY] = { key, runtime };
	return runtime;
}

const PROGRESS_KEY = Symbol.for('alandb.media.progress');
const progressGlobals = globalThis as unknown as Record<symbol, ProgressWriter | undefined>;

export function progressWriter(): ProgressWriter {
	let writer = progressGlobals[PROGRESS_KEY];
	if (!writer) {
		writer = new ProgressWriter((userId, entry) => saveProgress(userId, entry), {
			log: (m) => console.warn(`[media] ${m}`)
		});
		progressGlobals[PROGRESS_KEY] = writer;
	}
	return writer;
}

export interface ResolvedFile {
	file: MediaFileRecord;
	identity: FileIdentity;
}

/** The file by id, its real path checked inside the library roots, and its size/mtime. */
export async function resolveMediaFile(config: MediaConfig, fileId: string): Promise<ResolvedFile> {
	const file = await getMediaFile(fileId);
	if (!file) throw new MediaHttpError(404, 'Media file not found');
	const check = await resolveInsideRoots(file.path, config.roots);
	if (!check.ok) {
		if (check.reason === 'missing') throw new MediaHttpError(409, 'The file is no longer on disk');
		throw new MediaHttpError(403, 'The file is outside the media library');
	}
	try {
		const info = await stat(check.realPath);
		if (!info.isFile()) throw new Error('not a file');
		return { file, identity: { path: check.realPath, size: info.size, mtimeMs: info.mtimeMs } };
	} catch {
		throw new MediaHttpError(409, 'The file is no longer on disk');
	}
}

const QUALITIES: QualityLevel[] = ['original', '2160p', '1080p', '720p', '480p'];

function bool(value: unknown): boolean {
	return value === true;
}

/** Validates a POST /api/media/sessions body. */
export function parseStartRequest(body: unknown): StartSessionRequest & { startSeconds: number } {
	const input = (body ?? {}) as Record<string, unknown>;
	const fileId = input.fileId;
	if (typeof fileId !== 'string' || !/^[0-9a-f-]{36}$/iu.test(fileId)) {
		throw new MediaHttpError(400, 'fileId must be a media file id');
	}
	const audio = input.audio ?? null;
	if (
		audio !== null &&
		(!Number.isInteger(audio) || (audio as number) < 0 || (audio as number) > 99)
	) {
		throw new MediaHttpError(400, 'audio must be a track number or null');
	}
	const quality = (input.quality ?? 'original') as QualityLevel;
	if (!QUALITIES.includes(quality)) throw new MediaHttpError(400, 'Unknown quality level');
	const raw = (input.caps ?? null) as Record<string, unknown> | null;
	if (!raw || typeof raw !== 'object') throw new MediaHttpError(400, 'caps are required');
	const maxHeight = raw.maxHeight ?? null;
	if (maxHeight !== null && (!Number.isInteger(maxHeight) || (maxHeight as number) < 144)) {
		throw new MediaHttpError(400, 'caps.maxHeight must be null or a height in pixels');
	}
	const caps: ClientCaps = {
		h264: raw.h264 === undefined ? true : bool(raw.h264),
		hevc: bool(raw.hevc),
		hevcMain10: bool(raw.hevcMain10),
		av1: bool(raw.av1),
		nativeHls: bool(raw.nativeHls),
		maxHeight: maxHeight as number | null,
		ac3: bool(raw.ac3),
		eac3: bool(raw.eac3),
		hdrDisplay: bool(raw.hdrDisplay),
		multichannel: bool(raw.multichannel)
	};
	const start = input.startSeconds ?? 0;
	if (typeof start !== 'number' || !Number.isFinite(start) || start < 0) {
		throw new MediaHttpError(400, 'startSeconds must be a positive number');
	}
	return { fileId, audio: audio as number | null, caps, quality, startSeconds: start };
}

/** Starts a playback session for the owner and describes it for the player. */
export async function startPlayback(
	runtime: MediaRuntime,
	userId: string,
	request: StartSessionRequest & { startSeconds: number }
): Promise<PlaybackSession> {
	const { file, identity } = await resolveMediaFile(runtime.config, request.fileId);
	const video = file.video;
	if (!video) throw new MediaHttpError(409, 'The file has no video stream');
	if (!file.durationSeconds || file.durationSeconds <= 0) {
		throw new MediaHttpError(409, 'The file duration is unknown');
	}
	const known = await runtime.indexer.cached(identity);

	const quality = request.quality ?? 'original';
	const directPossible =
		quality === 'original' &&
		clientDecodes(video, request.caps) &&
		sourceTransfer(video) !== 'dovi-only';
	const index = directPossible
		? (known ??
			(await runtime.indexer.forPlayback({ ...identity, durationSeconds: file.durationSeconds })))
		: null;
	// Playback ends with the picture when a file carries audio past the end of its video.
	const videoEnd = (index ?? known)?.videoEnd;
	const duration = videoEnd ? Math.min(file.durationSeconds, videoEnd) : file.durationSeconds;
	const plan = chooseStreamPlan({
		file,
		caps: request.caps,
		quality,
		audio: request.audio,
		hasKeyframeIndex: !!index,
		encoders: runtime.support
	});
	const boundaries =
		plan.segments === 'keyframes' && index
			? planKeyframeSegments(index.keyframes, duration)
			: planUniformSegments(duration);
	const startSegment = segmentAt(boundaries, Math.min(request.startSeconds, duration));

	const sourceRate = video.bitRate ?? (identity.size * 8) / duration;
	const audioRate = plan.audio?.bitrate ?? 640_000;
	const bandwidth =
		plan.video.mode === 'copy' ? sourceRate * 2 : (plan.video.maxBitrate ?? sourceRate) + audioRate;
	const { id } = await runtime.sessions.create({
		ownerId: userId,
		fileId: file.id,
		inputPath: identity.path,
		plan,
		boundaries,
		durationSeconds: duration,
		startSegment,
		variant: {
			bandwidth,
			averageBandwidth: plan.video.mode === 'copy' ? sourceRate : undefined,
			width: plan.video.width,
			height: plan.video.height,
			frameRate: video.frameRate ?? null,
			videoRange:
				plan.video.transfer === 'pq' ? 'PQ' : plan.video.transfer === 'hlg' ? 'HLG' : 'SDR'
		}
	});

	// Embedded subtitles need a whole-file read: queue it now. The queue starts it only once this
	// session is far ahead and paused (and paces it), so switching subtitles on later is instant;
	// it is dropped if the owner leaves the file first.
	runtime.subtitles.prefetch(
		{
			id: file.id,
			path: identity.path,
			mtimeMs: identity.mtimeMs,
			subtitleTracks: file.subtitleTracks
		},
		runtime.queue
	);

	const audio = audioLabels(file.audioTracks);
	const textTracks = file.subtitleTracks.filter((t) => t.isText);
	const subtitles = subtitleLabels(textTracks);
	const base = `/api/media/files/${file.id}`;
	return {
		sessionId: id,
		playlistUrl: `/api/media/sessions/${id}/index.m3u8`,
		masterPlaylistUrl: `/api/media/sessions/${id}/master.m3u8`,
		durationSeconds: duration,
		segmentSeconds: TARGET_SEGMENT_SECONDS,
		startSeconds: boundaries[startSegment],
		audio: plan.audio?.ordinal ?? -1,
		audioTracks: file.audioTracks.map((track, i) => ({
			ordinal: track.ordinal,
			label: audio[i],
			language: track.language,
			codec: track.codec,
			channels: track.channels
		})),
		subtitleTracks: textTracks.map((track, i) => ({
			ordinal: track.ordinal,
			label: subtitles[i],
			language: track.language,
			url: `${base}/subtitles/${track.ordinal}.vtt`,
			forced: track.forced
		})),
		video: {
			mode: plan.video.mode,
			codec: plan.video.codec,
			width: plan.video.width,
			height: plan.video.height,
			hdr: plan.video.transfer !== 'sdr',
			reason: plan.video.reason
		},
		quality,
		qualities: availableQualities(file, request.caps),
		audioMode: plan.audio?.mode ?? 'copy',
		chaptersUrl: `${base}/chapters`,
		trickplayUrl: `${base}/trickplay.json`
	};
}

/** Maps any thrown value to a status and a client-safe message. */
export function errorStatus(error: unknown): { status: number; message: string } {
	const status = (error as { status?: unknown } | null)?.status;
	if (typeof status === 'number' && status >= 400 && status < 600) {
		return { status, message: (error as Error).message };
	}
	console.error('[media] unexpected error', error);
	return { status: 500, message: 'Media server error' };
}
