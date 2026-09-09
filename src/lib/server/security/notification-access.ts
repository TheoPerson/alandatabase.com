import { error } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { hasPermission } from '$lib/server/auth/permissions';

export function notificationUser(locals: App.Locals): NonNullable<App.Locals['user']> {
	if (!locals.user) throw error(401, 'Sign in to manage notifications.');
	if (locals.user.disabledAt || !hasPermission(locals.user, 'account:access')) {
		throw error(403, 'Account access required.');
	}
	return locals.user;
}

export function requireNotificationOrigin(request: Request, url: URL) {
	if (request.headers.get('origin') !== url.origin) {
		throw error(403, 'Cross-site notification changes are forbidden.');
	}
}

export async function notificationJson(request: Request): Promise<Record<string, unknown>> {
	if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
		throw error(415, 'JSON required.');
	}
	const reader = request.body?.getReader();
	if (!reader) throw error(400, 'Request body required.');
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.length;
			if (size > 8_192) {
				await reader.cancel();
				throw error(413, 'Request body too large.');
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	try {
		const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
		return value as Record<string, unknown>;
	} catch {
		throw error(400, 'Invalid JSON.');
	}
}

export function validCronAuthorization(request: Request, secret: string | undefined): boolean {
	if (!secret || secret.length < 32) return false;
	const expected = Buffer.from(`Bearer ${secret}`);
	const actual = Buffer.from(request.headers.get('authorization') ?? '');
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}
