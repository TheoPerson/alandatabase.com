// Settings of the media node split (docs/superpowers/specs/2026-10-19-media-node-design.md), read
// from the server environment. Unset or invalid values turn the feature off, never half on.

import { env } from '$env/dynamic/private';
import { usableGrantKey } from './grant';

type Source = Record<string, string | undefined>;

// An https origin, or plain http on this machine for local tests. No path, no trailing slash.
const ORIGIN = /^(?:https:\/\/[a-z0-9.-]+|http:\/\/(?:127\.0\.0\.1|localhost))(?::\d{1,5})?$/u;

function origin(value: string | undefined): string | null {
	const trimmed = value?.trim().toLowerCase() ?? '';
	return ORIGIN.test(trimmed) ? trimmed : null;
}

/** On the online app: where the owner's player streams from, and the key it signs grants with. */
export function appMediaRemote(source: Source = env): { origin: string; key: string } | null {
	const node = origin(source.MEDIA_ORIGIN);
	const key = source.MEDIA_GRANT_KEY;
	return node && usableGrantKey(key) ? { origin: node, key } : null;
}

/** On the owner's PC started with MEDIA_NODE=1: the app allowed to call it, and the shared key. */
export function mediaNodeSettings(source: Source = env): { appOrigin: string; key: string } | null {
	if (source.MEDIA_NODE !== '1') return null;
	const app = origin(source.MEDIA_APP_ORIGIN);
	const key = source.MEDIA_GRANT_KEY;
	if (!app || !usableGrantKey(key)) {
		throw new Error('MEDIA_NODE=1 needs MEDIA_APP_ORIGIN and a MEDIA_GRANT_KEY of 32+ characters');
	}
	return { appOrigin: app, key };
}
