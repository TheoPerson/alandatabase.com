// HTTP client of the owner-only media API (spec 13.3). Every failure becomes an HqpError carrying
// the server's { error } text; DELETE and PUT never throw and use keepalive so they survive unload.
import type {
	Chapter,
	PlaybackSession,
	QualityLevel,
	StartSessionRequest,
	TrickplayManifest
} from '$lib/media/types';
import type { HqpError, HqpErrorCode } from './types';

const CODES: Record<number, HqpErrorCode> = {
	400: 'bad-request',
	401: 'unauthorized',
	403: 'forbidden',
	404: 'not-found',
	409: 'gone',
	503: 'library-offline'
};

const MESSAGES: Record<HqpErrorCode, string> = {
	unauthorized: 'Your session expired.',
	forbidden: "This file isn't available.",
	'not-found': "This file isn't available.",
	gone: 'This file has moved or is gone from the library.',
	'library-offline': 'The media library is offline.',
	'bad-request': 'The server could not use this request.',
	network: 'Connection lost.',
	decode: "This device couldn't play this stream.",
	unsupported: "This browser can't play HLS video.",
	unknown: 'Something went wrong.'
};

/** An HqpError for an HTTP status (null = not an HTTP failure; `code` then decides). */
export function errorFromStatus(
	status: number | null,
	message: string | null,
	code?: HqpErrorCode,
	fallback: QualityLevel | null = null
): HqpError {
	const resolved = code ?? (status === null ? 'unknown' : (CODES[status] ?? 'unknown'));
	return { code: resolved, status, message: message || MESSAGES[resolved], fallback };
}

export class HqpRequestError extends Error {
	constructor(readonly error: HqpError) {
		super(error.message);
		this.name = 'HqpRequestError';
	}
}

const JSON_HEADERS = { 'content-type': 'application/json' };
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

function validSession(v: unknown): v is PlaybackSession {
	if (!isObj(v) || !isObj(v.video)) return false;
	return (
		typeof v.sessionId === 'string' &&
		typeof v.playlistUrl === 'string' &&
		isNum(v.durationSeconds) &&
		isNum(v.segmentSeconds) &&
		Array.isArray(v.audioTracks) &&
		Array.isArray(v.subtitleTracks) &&
		(v.video.mode === 'copy' || v.video.mode === 'transcode')
	);
}

function validManifest(v: unknown): v is TrickplayManifest {
	return (
		isObj(v) &&
		['pending', 'ready', 'unavailable'].includes(v.status as string) &&
		isNum(v.intervalSeconds) &&
		isNum(v.tileWidth) &&
		isNum(v.tileHeight) &&
		isNum(v.columns) &&
		isNum(v.rows) &&
		Array.isArray(v.sheets) &&
		v.sheets.every((s) => typeof s === 'string')
	);
}

export interface ProgressPut {
	fileId: string;
	positionSeconds: number;
	durationSeconds: number | null;
}

export type HqpApi = ReturnType<typeof createApi>;

export function createApi(fetchFn: typeof fetch) {
	async function send(url: string, init?: RequestInit): Promise<Response> {
		try {
			return await fetchFn(url, init);
		} catch {
			throw new HqpRequestError(errorFromStatus(null, null, 'network'));
		}
	}

	async function serverMessage(response: Response): Promise<string | null> {
		try {
			const body = (await response.json()) as { error?: unknown };
			return typeof body?.error === 'string' ? body.error : null;
		} catch {
			return null;
		}
	}

	async function getJson(url: string): Promise<unknown> {
		const response = await send(url);
		if (!response.ok) throw new HqpRequestError(errorFromStatus(response.status, null));
		return response.json();
	}

	return {
		async startSession(body: StartSessionRequest): Promise<PlaybackSession> {
			const response = await send('/api/media/sessions', {
				method: 'POST',
				headers: JSON_HEADERS,
				body: JSON.stringify(body)
			});
			if (response.status !== 201) {
				throw new HqpRequestError(errorFromStatus(response.status, await serverMessage(response)));
			}
			const session = await response.json().catch(() => null);
			if (!validSession(session)) throw new HqpRequestError(errorFromStatus(null, null));
			return session;
		},

		async deleteSession(sessionId: string): Promise<void> {
			await fetchFn(`/api/media/sessions/${encodeURIComponent(sessionId)}`, {
				method: 'DELETE',
				keepalive: true
			}).catch(() => undefined);
		},

		async putProgress(entry: ProgressPut, keepalive: boolean): Promise<boolean> {
			try {
				const response = await fetchFn('/api/media/progress', {
					method: 'PUT',
					headers: JSON_HEADERS,
					body: JSON.stringify(entry),
					keepalive
				});
				return response.ok;
			} catch {
				return false;
			}
		},

		async chapters(url: string): Promise<Chapter[]> {
			try {
				const list = await getJson(url);
				if (!Array.isArray(list)) return [];
				return list
					.filter((c) => isObj(c) && isNum(c.start) && isNum(c.end) && c.end > c.start)
					.map((c) => ({
						start: c.start as number,
						end: c.end as number,
						title: typeof c.title === 'string' ? c.title : null
					}))
					.sort((a, b) => a.start - b.start);
			} catch {
				return [];
			}
		},

		async trickplay(url: string): Promise<TrickplayManifest | null> {
			try {
				const manifest = await getJson(url);
				return validManifest(manifest) ? manifest : null;
			} catch {
				return null;
			}
		},

		/** The HTTP status of a GET (0 when the server cannot be reached). */
		async probe(url: string): Promise<number> {
			try {
				return (await fetchFn(url, { cache: 'no-store' })).status;
			} catch {
				return 0;
			}
		}
	};
}
