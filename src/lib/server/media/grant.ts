// Playback grants for the media node (docs/superpowers/specs/2026-10-19-media-node-design.md): the
// online app signs a short-lived owner grant, the owner's PC checks it. Pure functions; the node
// still re-checks the user in the database before honouring a grant.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const GRANT_TTL_SECONDS = 12 * 3600;
export const MIN_GRANT_KEY_LENGTH = 32;
export const GRANT_PARAM = 'mt';

const PREFIX = 'v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const TOKEN = /^v1\.[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{43}$/u;

function sign(body: string, key: string): string {
	return createHmac('sha256', key).update(body).digest('base64url');
}

export function usableGrantKey(key: string | undefined): key is string {
	return typeof key === 'string' && key.length >= MIN_GRANT_KEY_LENGTH;
}

export function mintGrant(
	userId: string,
	key: string,
	nowMs: number,
	ttlSeconds = GRANT_TTL_SECONDS
): string {
	if (!usableGrantKey(key)) throw new Error('MEDIA_GRANT_KEY must be at least 32 characters');
	if (!UUID.test(userId)) throw new Error('A grant needs a user id');
	const payload = Buffer.from(
		JSON.stringify({ u: userId, exp: Math.floor(nowMs / 1000) + ttlSeconds, aud: 'media' })
	).toString('base64url');
	const body = `${PREFIX}.${payload}`;
	return `${body}.${sign(body, key)}`;
}

/** The user id of a valid, unexpired media grant; null for anything else. */
export function verifyGrant(
	token: string | null | undefined,
	key: string | undefined,
	nowMs: number
): { userId: string } | null {
	if (!token || !usableGrantKey(key) || !TOKEN.test(token)) return null;
	const cut = token.lastIndexOf('.');
	const body = token.slice(0, cut);
	const given = Buffer.from(token.slice(cut + 1));
	const expected = Buffer.from(sign(body, key));
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
	try {
		const claims = JSON.parse(Buffer.from(body.slice(PREFIX.length + 1), 'base64url').toString());
		if (claims?.aud !== 'media' || typeof claims.u !== 'string' || !UUID.test(claims.u))
			return null;
		if (typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs) return null;
		return { userId: claims.u };
	} catch {
		return null;
	}
}

/** `path` with the grant appended as its `mt` query parameter. */
export function withGrant(path: string, token: string): string {
	return `${path}${path.includes('?') ? '&' : '?'}${GRANT_PARAM}=${encodeURIComponent(token)}`;
}

/** An HLS playlist whose every URI (plain lines and URI="…" attributes) carries the grant. */
export function grantPlaylist(playlist: string, token: string): string {
	return playlist
		.split('\n')
		.map((line) => {
			if (line === '') return line;
			if (!line.startsWith('#')) return withGrant(line, token);
			return line.replace(
				/URI="([^"]+)"/gu,
				(_all, uri: string) => `URI="${withGrant(uri, token)}"`
			);
		})
		.join('\n');
}
