import { redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { invalidateSession, SESSION_COOKIE_DELETE_OPTIONS } from '$lib/server/auth';
import { getAuthPortalUrl } from '$lib/host-routing';

async function logout({ locals, cookies }: { locals: App.Locals; cookies: Cookies }) {
	if (locals.session) {
		await invalidateSession(locals.session.id);
	}

	cookies.delete('session', SESSION_COOKIE_DELETE_OPTIONS);
}

export async function GET({ locals, cookies, url }) {
	await logout({ locals, cookies });
	throw redirect(303, getAuthPortalUrl(url, '/movies'));
}

export async function POST({ locals, cookies, url }) {
	await logout({ locals, cookies });
	throw redirect(303, getAuthPortalUrl(url, '/movies'));
}
