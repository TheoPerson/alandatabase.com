// Request handlers of the owner-only media API (src/routes/api/media/**). Every handler checks the
// owner itself (defence in depth on top of the route guard), answers private/no-store, and JSON
// mutations require a same-origin request.

import { stat } from 'node:fs/promises';
import {
	bytes,
	fail,
	file,
	isSameOrigin,
	json,
	noContent,
	requireOwner,
	SESSION_ID_PATTERN,
	text,
	UUID_PATTERN
} from './http';
import { resolveInsideRoots } from './paths';
import { getExternalSubtitlePath, getProgress, listContinueWatching } from './repository';
import {
	errorStatus,
	MediaHttpError,
	mediaConfig,
	mediaRuntime,
	parseStartRequest,
	progressWriter,
	resolveMediaFile,
	startPlayback
} from './service';

export interface MediaEvent {
	locals: App.Locals;
	params: Record<string, string>;
	request: Request;
	url: URL;
}

const HLS_TYPE = 'application/vnd.apple.mpegurl';
const MAX_POSITION = 7 * 24 * 3600;

async function guarded(
	event: MediaEvent,
	options: { mutation?: boolean },
	handler: (userId: string) => Promise<Response>
): Promise<Response> {
	const owner = requireOwner(event.locals.user);
	if (owner instanceof Response) return owner;
	if (options.mutation && !isSameOrigin(event.request, event.url)) {
		return fail(403, 'Cross-site requests are forbidden');
	}
	try {
		return await handler(owner.userId);
	} catch (error) {
		const { status, message } = errorStatus(error);
		return fail(status, message);
	}
}

async function readJson(request: Request): Promise<unknown> {
	if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
		throw new MediaHttpError(415, 'Expected application/json');
	}
	try {
		return await request.json();
	} catch {
		throw new MediaHttpError(400, 'Invalid JSON body');
	}
}

function fileIdParam(event: MediaEvent): string {
	const fileId = event.params.fileId ?? '';
	if (!UUID_PATTERN.test(fileId)) throw new MediaHttpError(404, 'Media file not found');
	return fileId;
}

function sessionParam(event: MediaEvent): string {
	const sid = event.params.sid ?? '';
	if (!SESSION_ID_PATTERN.test(sid)) throw new MediaHttpError(404, 'Playback session not found');
	return sid;
}

/** POST /api/media/sessions */
export function startSession(event: MediaEvent): Promise<Response> {
	return guarded(event, { mutation: true }, async (userId) => {
		const request = parseStartRequest(await readJson(event.request));
		const runtime = await mediaRuntime();
		return json(await startPlayback(runtime, userId, request), 201);
	});
}

/** DELETE /api/media/sessions/<sid> */
export function stopSession(event: MediaEvent): Promise<Response> {
	return guarded(event, { mutation: true }, async (userId) => {
		const sid = sessionParam(event);
		const runtime = await mediaRuntime();
		if (!runtime.sessions.stop(sid, userId))
			throw new MediaHttpError(404, 'Playback session not found');
		return noContent();
	});
}

const ASSET = /^(?:(index|master)\.m3u8|(init)\.mp4|seg-(\d{1,6})\.m4s)$/u;

/** GET /api/media/sessions/<sid>/(index.m3u8|master.m3u8|init.mp4|seg-<k>.m4s) */
export function sessionAsset(event: MediaEvent): Promise<Response> {
	return guarded(event, {}, async (userId) => {
		const sid = sessionParam(event);
		const match = ASSET.exec(event.params.name ?? '');
		if (!match) throw new MediaHttpError(404, 'Not found');
		const runtime = await mediaRuntime();
		const [, playlist, init, segment] = match;
		if (playlist === 'index') return text(runtime.sessions.playlist(sid, userId), HLS_TYPE);
		if (playlist === 'master') return text(await runtime.sessions.master(sid, userId), HLS_TYPE);
		if (init) return bytes(await runtime.sessions.init(sid, userId), 'video/mp4');
		const ready = await runtime.sessions.segment(sid, userId, Number(segment));
		return file(ready.path, ready.size, 'video/mp4');
	});
}

/** GET /api/media/files/<fileId>/subtitles/<ordinal>.vtt */
export function subtitle(event: MediaEvent): Promise<Response> {
	return guarded(event, {}, async () => {
		const fileId = fileIdParam(event);
		const match = /^(\d{1,3})\.vtt$/u.exec(event.params.name ?? '');
		if (!match) throw new MediaHttpError(404, 'Subtitle track not found');
		const ordinal = Number(match[1]);
		const runtime = await mediaRuntime();
		const { file: record, identity } = await resolveMediaFile(runtime.config, fileId);
		const track = record.subtitleTracks.find((t) => t.ordinal === ordinal);
		let externalPath: string | null = null;
		if (track?.source === 'external') {
			const path = await getExternalSubtitlePath(fileId, ordinal);
			if (path) {
				const check = await resolveInsideRoots(path, runtime.config.roots);
				if (!check.ok) {
					throw check.reason === 'missing'
						? new MediaHttpError(409, 'The subtitle file is no longer on disk')
						: new MediaHttpError(403, 'The subtitle file is outside the media library');
				}
				externalPath = check.realPath;
			}
		}
		const path = await runtime.subtitles.get(
			{
				id: record.id,
				path: identity.path,
				mtimeMs: identity.mtimeMs,
				subtitleTracks: record.subtitleTracks
			},
			ordinal,
			externalPath
		);
		const info = await stat(path);
		return file(path, info.size, 'text/vtt; charset=utf-8');
	});
}

/** GET /api/media/files/<fileId>/chapters */
export function chapters(event: MediaEvent): Promise<Response> {
	return guarded(event, {}, async () => {
		const fileId = fileIdParam(event);
		const runtime = await mediaRuntime();
		const { file: record, identity } = await resolveMediaFile(runtime.config, fileId);
		return json(
			await runtime.chapters.get({ ...identity, durationSeconds: record.durationSeconds })
		);
	});
}

/** GET /api/media/files/<fileId>/trickplay.json */
export function trickplayManifest(event: MediaEvent): Promise<Response> {
	return guarded(event, {}, async () => {
		const fileId = fileIdParam(event);
		const runtime = await mediaRuntime();
		const { file: record, identity } = await resolveMediaFile(runtime.config, fileId);
		const manifest = await runtime.trickplay.manifest(
			{ ...identity, id: record.id, durationSeconds: record.durationSeconds, video: record.video },
			(sheet) => `/api/media/files/${record.id}/trickplay/${sheet}.webp`
		);
		return json(manifest);
	});
}

/** GET /api/media/files/<fileId>/trickplay/<n>.webp */
export function trickplaySheet(event: MediaEvent): Promise<Response> {
	return guarded(event, {}, async () => {
		const fileId = fileIdParam(event);
		const match = /^(\d{1,4})\.webp$/u.exec(event.params.sheet ?? '');
		if (!match) throw new MediaHttpError(404, 'Not found');
		const runtime = await mediaRuntime();
		const { identity } = await resolveMediaFile(runtime.config, fileId);
		const path = runtime.trickplay.sheetPath(identity, Number(match[1]));
		const info = await stat(path).catch(() => null);
		if (!info?.isFile()) throw new MediaHttpError(404, 'Not found');
		return file(path, info.size, 'image/webp');
	});
}

/** GET /api/media/progress?fileIds=a,b */
export function readProgress(event: MediaEvent): Promise<Response> {
	return guarded(event, {}, async (userId) => {
		mediaConfig();
		const ids = (event.url.searchParams.get('fileIds') ?? '')
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean);
		if (ids.length > 200) throw new MediaHttpError(400, 'At most 200 file ids');
		if (ids.some((id) => !UUID_PATTERN.test(id))) throw new MediaHttpError(400, 'Invalid file id');
		if (ids.length === 0) return json([]);
		return json(await getProgress(userId, ids));
	});
}

/** PUT /api/media/progress {fileId, positionSeconds, durationSeconds} */
export function writeProgress(event: MediaEvent): Promise<Response> {
	return guarded(event, { mutation: true }, async (userId) => {
		mediaConfig();
		const body = (await readJson(event.request)) as Record<string, unknown> | null;
		const fileId = body?.fileId;
		const position = body?.positionSeconds;
		const duration = body?.durationSeconds ?? null;
		if (typeof fileId !== 'string' || !UUID_PATTERN.test(fileId)) {
			throw new MediaHttpError(400, 'fileId must be a media file id');
		}
		if (
			typeof position !== 'number' ||
			!Number.isFinite(position) ||
			position < 0 ||
			position > MAX_POSITION
		) {
			throw new MediaHttpError(400, 'positionSeconds must be a number of seconds');
		}
		if (
			duration !== null &&
			(typeof duration !== 'number' ||
				!Number.isFinite(duration) ||
				duration <= 0 ||
				duration > MAX_POSITION)
		) {
			throw new MediaHttpError(400, 'durationSeconds must be null or a positive number');
		}
		const outcome = await progressWriter().submit(userId, {
			fileId,
			positionSeconds: position,
			durationSeconds: duration as number | null
		});
		if (outcome === 'unknown-file') throw new MediaHttpError(404, 'Media file not found');
		return noContent();
	});
}

/** GET /api/media/continue */
export function continueWatching(event: MediaEvent): Promise<Response> {
	return guarded(event, {}, async (userId) => {
		mediaConfig();
		const limit = Number(event.url.searchParams.get('limit') ?? 20);
		if (!Number.isInteger(limit) || limit < 1 || limit > 50)
			throw new MediaHttpError(400, 'limit must be 1-50');
		return json(await listContinueWatching(userId, limit));
	});
}
