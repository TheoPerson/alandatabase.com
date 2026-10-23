import { describe, expect, it } from 'vitest';
import { grantPlaylist, mintGrant, verifyGrant, withGrant } from './grant';

const KEY = 'k'.repeat(40);
const OTHER_KEY = 'z'.repeat(40);
const USER = '00000000-0000-4000-8000-0000000000aa';
const NOW = 1_800_000_000_000;

describe('media playback grants', () => {
	it('verifies its own grant and returns the user', () => {
		const token = mintGrant(USER, KEY, NOW);
		expect(verifyGrant(token, KEY, NOW + 1000)).toEqual({ userId: USER });
	});

	it('refuses an expired grant', () => {
		const token = mintGrant(USER, KEY, NOW, 60);
		expect(verifyGrant(token, KEY, NOW + 59_000)).not.toBeNull();
		expect(verifyGrant(token, KEY, NOW + 60_000)).toBeNull();
	});

	it('refuses a grant signed with another key, or a tampered one', () => {
		const token = mintGrant(USER, KEY, NOW);
		expect(verifyGrant(token, OTHER_KEY, NOW)).toBeNull();
		const [prefix, , signature] = token.split('.');
		const forged = Buffer.from(
			JSON.stringify({ u: USER, exp: NOW / 1000 + 10 ** 7, aud: 'media' })
		).toString('base64url');
		expect(verifyGrant(`${prefix}.${forged}.${signature}`, KEY, NOW)).toBeNull();
		expect(verifyGrant(`${token}x`, KEY, NOW)).toBeNull();
	});

	it('refuses junk, a missing token and a short key', () => {
		expect(verifyGrant(null, KEY, NOW)).toBeNull();
		expect(verifyGrant('v1.abc.def', KEY, NOW)).toBeNull();
		expect(verifyGrant(mintGrant(USER, KEY, NOW), 'short', NOW)).toBeNull();
		expect(() => mintGrant(USER, 'short', NOW)).toThrow();
		expect(() => mintGrant('not-a-uuid', KEY, NOW)).toThrow();
	});

	it('appends the grant to a path with or without a query', () => {
		expect(withGrant('/a.vtt', 't.x')).toBe('/a.vtt?mt=t.x');
		expect(withGrant('/a?b=1', 't')).toBe('/a?b=1&mt=t');
	});

	it('carries the grant on every URI of a playlist', () => {
		const playlist = [
			'#EXTM3U',
			'#EXT-X-MAP:URI="init.mp4"',
			'#EXTINF:6.000000,',
			'seg-0.m4s',
			'#EXT-X-ENDLIST',
			''
		].join('\n');
		expect(grantPlaylist(playlist, 'T')).toBe(
			[
				'#EXTM3U',
				'#EXT-X-MAP:URI="init.mp4?mt=T"',
				'#EXTINF:6.000000,',
				'seg-0.m4s?mt=T',
				'#EXT-X-ENDLIST',
				''
			].join('\n')
		);
	});
});
