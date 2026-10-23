import { describe, expect, it, vi } from 'vitest';
import { mintGrant } from './grant';
import { mediaNodeGate } from './node-gate';
import { appMediaRemote, mediaNodeSettings } from './remote';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const KEY = 'k'.repeat(40);
const OWNER = '00000000-0000-4000-8000-0000000000aa';
const NOW = 1_800_000_000_000;
const settings = { appOrigin: 'https://alandatabase.com', key: KEY };
const req = (method: string, path: string, origin: string | null = 'https://alandatabase.com') => ({
	method,
	url: new URL(`http://127.0.0.1:4174${path}`),
	origin
});
const ownerOnly = async (id: string) => id === OWNER;

describe('media node gate', () => {
	it('serves nothing but the media API and health', async () => {
		for (const path of ['/', '/auth/login', '/movies', '/api/movies/catalog', '/my/films']) {
			const verdict = await mediaNodeGate(req('GET', path), settings, ownerOnly, NOW);
			expect(verdict.kind === 'respond' && verdict.response.status, path).toBe(404);
		}
		const health = await mediaNodeGate(req('GET', '/api/health'), settings, ownerOnly, NOW);
		expect(health.kind).toBe('continue');
	});

	it('answers the app preflight and refuses any other origin', async () => {
		const ok = await mediaNodeGate(req('OPTIONS', '/api/media/sessions'), settings, ownerOnly, NOW);
		expect(ok.kind === 'respond' && ok.response.status).toBe(204);
		expect(ok.kind === 'respond' && ok.response.headers.get('access-control-allow-origin')).toBe(
			'https://alandatabase.com'
		);
		const evil = await mediaNodeGate(
			req('OPTIONS', '/api/media/sessions', 'https://evil.example'),
			settings,
			ownerOnly,
			NOW
		);
		expect(evil.kind === 'respond' && evil.response.status).toBe(403);
	});

	it('signs in the owner from a valid grant', async () => {
		const grant = mintGrant(OWNER, KEY, NOW);
		const verdict = await mediaNodeGate(
			req('GET', `/api/media/files/x/chapters?mt=${grant}`),
			settings,
			ownerOnly,
			NOW
		);
		expect(verdict).toEqual({ kind: 'continue', userId: OWNER, grant });
	});

	it('ignores a missing, expired or foreign grant, and a user no longer owner', async () => {
		const expired = mintGrant(OWNER, KEY, NOW - 13 * 3600 * 1000);
		const foreign = mintGrant(OWNER, 'z'.repeat(40), NOW);
		const demoted = mintGrant('00000000-0000-4000-8000-0000000000bb', KEY, NOW);
		for (const query of ['', `?mt=${expired}`, `?mt=${foreign}`, `?mt=${demoted}`]) {
			const verdict = await mediaNodeGate(
				req('GET', `/api/media/progress${query}`),
				settings,
				ownerOnly,
				NOW
			);
			expect(verdict, query).toEqual({ kind: 'continue', userId: null, grant: null });
		}
	});
});

describe('media node settings', () => {
	it('stays off unless both sides are fully configured', () => {
		expect(appMediaRemote({})).toBeNull();
		expect(
			appMediaRemote({ MEDIA_ORIGIN: 'https://pc.ts.net:8443', MEDIA_GRANT_KEY: 'short' })
		).toBeNull();
		expect(appMediaRemote({ MEDIA_ORIGIN: 'http://pc.ts.net', MEDIA_GRANT_KEY: KEY })).toBeNull();
		expect(
			appMediaRemote({ MEDIA_ORIGIN: 'https://pc.ts.net:8443/', MEDIA_GRANT_KEY: KEY })
		).toBeNull();
		expect(
			appMediaRemote({ MEDIA_ORIGIN: 'https://pc.ts.net:8443', MEDIA_GRANT_KEY: KEY })
		).toEqual({
			origin: 'https://pc.ts.net:8443',
			key: KEY
		});
		expect(mediaNodeSettings({})).toBeNull();
		expect(() => mediaNodeSettings({ MEDIA_NODE: '1' })).toThrow();
		expect(
			mediaNodeSettings({
				MEDIA_NODE: '1',
				MEDIA_APP_ORIGIN: 'https://alandatabase.com',
				MEDIA_GRANT_KEY: KEY
			})
		).toEqual({ appOrigin: 'https://alandatabase.com', key: KEY });
	});
});
