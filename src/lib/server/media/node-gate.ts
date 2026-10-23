// The media node's front door: only the media API, called by the online app with a playback grant.
// Pure over its inputs (the owner lookup is injected) so every rule is unit-tested.

import { GRANT_PARAM, verifyGrant } from './grant';

export interface NodeSettings {
	appOrigin: string;
	key: string;
}

export interface NodeRequest {
	method: string;
	url: URL;
	origin: string | null;
}

export type NodeVerdict =
	| { kind: 'respond'; response: Response }
	// Continue to the app; `userId` is set only for a valid grant of a user the lookup accepted.
	| { kind: 'continue'; userId: string | null; grant: string | null };

function allowedPath(pathname: string): boolean {
	return pathname === '/api/health' || pathname.startsWith('/api/media/');
}

export function corsHeaders(settings: NodeSettings): Record<string, string> {
	return {
		'access-control-allow-origin': settings.appOrigin,
		vary: 'Origin'
	};
}

export async function mediaNodeGate(
	request: NodeRequest,
	settings: NodeSettings,
	isActiveOwner: (userId: string) => Promise<boolean>,
	nowMs: number
): Promise<NodeVerdict> {
	if (!allowedPath(request.url.pathname)) {
		return { kind: 'respond', response: new Response('Not found', { status: 404 }) };
	}

	if (request.method === 'OPTIONS') {
		if (request.origin !== settings.appOrigin) {
			return { kind: 'respond', response: new Response(null, { status: 403 }) };
		}
		return {
			kind: 'respond',
			response: new Response(null, {
				status: 204,
				headers: {
					...corsHeaders(settings),
					'access-control-allow-methods': 'GET, POST, PUT, DELETE',
					'access-control-allow-headers': 'content-type',
					'access-control-max-age': '600'
				}
			})
		};
	}

	const grant = request.url.searchParams.get(GRANT_PARAM);
	const claims = verifyGrant(grant, settings.key, nowMs);
	if (!claims || !(await isActiveOwner(claims.userId))) {
		return { kind: 'continue', userId: null, grant: null };
	}
	return { kind: 'continue', userId: claims.userId, grant };
}
