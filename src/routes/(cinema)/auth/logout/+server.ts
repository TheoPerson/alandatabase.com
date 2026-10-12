import { redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { invalidateSession, sessionCookieDeleteOptions } from '$lib/server/auth';
import { getAuthPortalUrl } from '$lib/host-routing';

async function logout({
	locals,
	cookies,
	url
}: {
	locals: App.Locals;
	cookies: Cookies;
	url: URL;
}) {
	if (locals.session) {
		await invalidateSession(locals.session.id);
	}

	cookies.delete('session', sessionCookieDeleteOptions(url));
}

export function GET() {
	return new Response('Sign out requires a POST request.', {
		status: 405,
		headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8' }
	});
}

export async function POST({ locals, cookies, url }) {
	await logout({ locals, cookies, url });
	throw redirect(303, getAuthPortalUrl(url, '/movies'));
}
