import { describe, expect, it, vi } from 'vitest';
import type { PlaybackSession } from '$lib/media/types';
import { createApi, errorFromStatus, HqpRequestError } from './api';

const SESSION: PlaybackSession = {
	sessionId: 'abc123',
	playlistUrl: '/api/media/sessions/abc123/index.m3u8',
	masterPlaylistUrl: '/api/media/sessions/abc123/master.m3u8',
	durationSeconds: 3600,
	segmentSeconds: 4,
	audio: 1,
	audioTracks: [{ ordinal: 1, label: 'French 5.1', language: 'fre' }],
	subtitleTracks: [],
	video: { mode: 'copy', codec: 'hevc', height: 2160, hdr: true, reason: 'Original stream' },
	qualities: ['original', '1080p'],
	quality: 'original',
	audioMode: 'copy',
	chaptersUrl: '/api/media/files/f/chapters',
	trickplayUrl: '/api/media/files/f/trickplay.json'
};

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const CAPS = {
	h264: true,
	hevc: true,
	hevcMain10: true,
	av1: true,
	nativeHls: false,
	maxHeight: null
};

describe('api', () => {
	it('posts the session request as JSON and parses the 201 body', async () => {
		const fetch = vi.fn(async () => json(201, SESSION));
		const api = createApi(fetch as typeof globalThis.fetch);
		const body = {
			fileId: 'f',
			audio: 1,
			caps: CAPS,
			quality: 'original' as const,
			startSeconds: 600
		};
		await expect(api.startSession(body)).resolves.toEqual(SESSION);
		const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('/api/media/sessions');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({ 'content-type': 'application/json' });
		expect(JSON.parse(init.body as string)).toEqual(body);
	});

	it.each([
		[400, 'bad-request'],
		[401, 'unauthorized'],
		[403, 'forbidden'],
		[404, 'not-found'],
		[409, 'gone'],
		[503, 'library-offline'],
		[500, 'unknown']
	] as const)('maps %i to %s with the server message', async (status, code) => {
		const api = createApi((async () => json(status, { error: `server says ${status}` })) as never);
		const error = await api.startSession({ fileId: 'f', audio: null, caps: CAPS }).catch((e) => e);
		expect(error).toBeInstanceOf(HqpRequestError);
		expect(error.error).toEqual({
			code,
			status,
			message: `server says ${status}`,
			fallback: null
		});
	});

	it('uses a plain sentence when the server sends no message, and maps network failures', async () => {
		const api = createApi((async () => new Response('oops', { status: 503 })) as never);
		const error = await api.startSession({ fileId: 'f', audio: null, caps: CAPS }).catch((e) => e);
		expect(error.error.code).toBe('library-offline');
		expect(error.error.message).toBe('The media library is offline.');

		const offline = createApi((async () => {
			throw new TypeError('Failed to fetch');
		}) as never);
		const net = await offline
			.startSession({ fileId: 'f', audio: null, caps: CAPS })
			.catch((e) => e);
		expect(net.error).toMatchObject({ code: 'network', status: null });
	});

	it('rejects a malformed session body as unknown', async () => {
		const api = createApi((async () => json(201, { sessionId: 3 })) as never);
		const error = await api.startSession({ fileId: 'f', audio: null, caps: CAPS }).catch((e) => e);
		expect(error.error.code).toBe('unknown');
	});

	it('DELETE and PUT use keepalive; PUT reports success', async () => {
		const fetch = vi.fn(async () => new Response(null, { status: 204 }));
		const api = createApi(fetch as never);
		await api.deleteSession('abc123');
		const entry = { fileId: 'f', positionSeconds: 61.5, durationSeconds: 3600 };
		await expect(api.putProgress(entry, true)).resolves.toBe(true);
		const [delUrl, delInit] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(delUrl).toBe('/api/media/sessions/abc123');
		expect(delInit).toMatchObject({ method: 'DELETE', keepalive: true });
		const [putUrl, putInit] = fetch.mock.calls[1] as unknown as [string, RequestInit];
		expect(putUrl).toBe('/api/media/progress');
		expect(putInit).toMatchObject({ method: 'PUT', keepalive: true });
		expect(JSON.parse(putInit.body as string)).toEqual(entry);
	});

	it('never throws from DELETE or PUT', async () => {
		const api = createApi((async () => {
			throw new TypeError('offline');
		}) as never);
		await expect(api.deleteSession('x')).resolves.toBeUndefined();
		await expect(
			api.putProgress({ fileId: 'f', positionSeconds: 1, durationSeconds: null }, false)
		).resolves.toBe(false);
		const failing = createApi((async () => new Response(null, { status: 500 })) as never);
		await expect(
			failing.putProgress({ fileId: 'f', positionSeconds: 1, durationSeconds: null }, false)
		).resolves.toBe(false);
	});

	it('validates chapters and sorts them; failures give []', async () => {
		const body = [
			{ start: 600, end: 700, title: 'Credits' },
			{ start: 0, end: 600, title: null },
			{ start: 'x', end: 1, title: 'bad' }
		];
		const api = createApi((async () => json(200, body)) as never);
		await expect(api.chapters('/c')).resolves.toEqual([
			{ start: 0, end: 600, title: null },
			{ start: 600, end: 700, title: 'Credits' }
		]);
		const down = createApi((async () => json(503, { error: 'off' })) as never);
		await expect(down.chapters('/c')).resolves.toEqual([]);
	});

	it('validates a trickplay manifest; failures give null', async () => {
		const manifest = {
			status: 'ready',
			intervalSeconds: 10,
			tileWidth: 240,
			tileHeight: 135,
			columns: 10,
			rows: 10,
			sheets: ['/api/media/files/f/trickplay/0.webp']
		};
		await expect(
			createApi((async () => json(200, manifest)) as never).trickplay('/t')
		).resolves.toEqual(manifest);
		const bad = createApi((async () => json(200, { status: 'nope' })) as never);
		await expect(bad.trickplay('/t')).resolves.toBeNull();
	});

	it('probes a URL status (0 when unreachable)', async () => {
		await expect(
			createApi((async () => new Response('', { status: 404 })) as never).probe('/p')
		).resolves.toBe(404);
		const offline = createApi((async () => {
			throw new TypeError('x');
		}) as never);
		await expect(offline.probe('/p')).resolves.toBe(0);
	});

	it('errorFromStatus carries a fallback level when given', () => {
		expect(errorFromStatus(409, null)).toMatchObject({ code: 'gone', message: expect.any(String) });
		expect(errorFromStatus(null, null, 'decode', '1080p')).toMatchObject({
			code: 'decode',
			status: null,
			fallback: '1080p'
		});
	});
});

describe('api against the media node (online site)', () => {
	const remote = { origin: 'https://pc.example.ts.net:8443', token: 'v1.abc.def' };
	const granted = (path: string) => `${path}?mt=v1.abc.def`;

	it('calls the node with the grant and resolves the paths it hands back', async () => {
		const fromNode = {
			...SESSION,
			playlistUrl: granted(SESSION.playlistUrl),
			masterPlaylistUrl: granted(SESSION.masterPlaylistUrl!),
			subtitleTracks: [
				{
					ordinal: 3,
					label: 'English',
					language: 'eng',
					url: granted('/api/media/files/f/subtitles/3.vtt')
				}
			],
			chaptersUrl: granted(SESSION.chaptersUrl!),
			trickplayUrl: granted(SESSION.trickplayUrl!)
		};
		const fetch = vi.fn(async (_url: string) => json(201, fromNode));
		const api = createApi(fetch as unknown as typeof globalThis.fetch, () => remote);
		const session = await api.startSession({ fileId: 'f', audio: 1, caps: CAPS } as never);

		expect(fetch.mock.calls[0][0]).toBe(
			'https://pc.example.ts.net:8443/api/media/sessions?mt=v1.abc.def'
		);
		expect(session.playlistUrl).toBe(
			'https://pc.example.ts.net:8443/api/media/sessions/abc123/index.m3u8?mt=v1.abc.def'
		);
		expect(session.subtitleTracks[0].url).toBe(
			'https://pc.example.ts.net:8443/api/media/files/f/subtitles/3.vtt?mt=v1.abc.def'
		);
		expect(session.trickplayUrl?.startsWith('https://pc.example.ts.net:8443/')).toBe(true);
	});

	it('sends progress and stop to the node, and resolves trickplay sheets', async () => {
		const fetch = vi.fn(async (url: string) =>
			url.includes('trickplay.json')
				? json(200, {
						status: 'ready',
						intervalSeconds: 10,
						tileWidth: 480,
						tileHeight: 270,
						columns: 6,
						rows: 6,
						sheets: [granted('/api/media/files/f/trickplay/0.webp')]
					})
				: new Response(null, { status: 204 })
		);
		const api = createApi(fetch as unknown as typeof globalThis.fetch, () => remote);
		await api.putProgress({ fileId: 'f', positionSeconds: 1, durationSeconds: 2 } as never, false);
		await api.deleteSession('abc123');
		const manifest = await api.trickplay(
			'https://pc.example.ts.net:8443/api/media/files/f/trickplay.json?mt=v1.abc.def'
		);

		expect(fetch.mock.calls[0][0]).toBe(
			'https://pc.example.ts.net:8443/api/media/progress?mt=v1.abc.def'
		);
		expect(fetch.mock.calls[1][0]).toBe(
			'https://pc.example.ts.net:8443/api/media/sessions/abc123?mt=v1.abc.def'
		);
		expect(manifest?.sheets[0]).toBe(
			'https://pc.example.ts.net:8443/api/media/files/f/trickplay/0.webp?mt=v1.abc.def'
		);
	});

	it('stays same-origin without a node', async () => {
		const fetch = vi.fn(async (_url: string) => json(201, SESSION));
		const api = createApi(fetch as typeof globalThis.fetch);
		const session = await api.startSession({ fileId: 'f', audio: 1, caps: CAPS } as never);
		expect(fetch.mock.calls[0][0]).toBe('/api/media/sessions');
		expect(session.playlistUrl).toBe(SESSION.playlistUrl);
	});
});
