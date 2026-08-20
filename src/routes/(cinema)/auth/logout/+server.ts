import { redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { invalidateSession, SESSION_COOKIE_OPTIONS } from '$lib/server/auth';
import { getAuthPortalUrl } from '$lib/host-routing';

async function logout({ locals, cookies }: { locals: App.Locals; cookies: Cookies }) {
	if (locals.session) {
		await invalidateSession(locals.session.id);
	}

	cookies.delete('session', {
		path: '/',
		domain: SESSION_COOKIE_OPTIONS.domain
	});
}

export async function GET({ locals, cookies, url }) {
	await logout({ locals, cookies });
	throw redirect(303, getAuthPortalUrl(url, '/movies'));
}

export async function POST({ locals, cookies, url }) {
	await logout({ locals, cookies });
	throw redirect(303, getAuthPortalUrl(url, '/movies'));
}
