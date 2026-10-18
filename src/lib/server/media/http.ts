// Shared response helpers for the owner-only media API.

import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { isOwnerUser } from '$lib/server/auth/owner';

export const PRIVATE_NO_STORE = { 'cache-control': 'private, no-store' } as const;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const SESSION_ID_PATTERN = /^[0-9a-f]{32}$/u;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...PRIVATE_NO_STORE, ...headers }
	});
}

export function fail(status: number, error: string): Response {
	return json({ error }, status);
}

export function noContent(): Response {
	return new Response(null, { status: 204, headers: { ...PRIVATE_NO_STORE } });
}

export function text(body: string, contentType: string): Response {
	return new Response(body, {
		status: 200,
		headers: { 'content-type': contentType, ...PRIVATE_NO_STORE }
	});
}

export function bytes(body: Uint8Array, contentType: string): Response {
	return new Response(Buffer.from(body), {
		status: 200,
		headers: {
			'content-type': contentType,
			'content-length': String(body.length),
			...PRIVATE_NO_STORE
		}
	});
}

export function file(path: string, size: number, contentType: string): Response {
	const stream = Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;
	return new Response(stream, {
		status: 200,
		headers: { 'content-type': contentType, 'content-length': String(size), ...PRIVATE_NO_STORE }
	});
}

type MaybeUser = App.Locals['user'];

/** The owner's user id, or the 401/403 response to return. */
export function requireOwner(user: MaybeUser): { userId: string } | Response {
	if (!user) return fail(401, 'Unauthorized');
	if (!isOwnerUser(user)) return fail(403, 'Owner access required');
	return { userId: user.id };
}

/** JSON mutations must come from this site (Origin header equal to the request origin). */
export function isSameOrigin(request: Request, url: URL): boolean {
	const origin = request.headers.get('origin');
	return !!origin && origin === url.origin;
}
