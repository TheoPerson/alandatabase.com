import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	verifyPassword,
	createSession,
	generateSessionToken,
	SESSION_COOKIE_OPTIONS
} from '$lib/server/auth';
import { validateReturnTo } from '$lib/server/auth/cinema-access';
import { eq, or } from 'drizzle-orm';

export async function load({ locals, url }) {
	const returnTo = url.searchParams.get('returnTo');
	if (locals.user) {
		throw redirect(302, validateReturnTo(returnTo));
	}
	return { returnTo };
}

export const actions = {
	login: async ({ request, cookies, url }) => {
		const formData = await request.formData();
		const identifier = formData.get('identifier')?.toString().trim().toLowerCase();
		const password = formData.get('password')?.toString();
		const returnTo = url.searchParams.get('returnTo');

		if (!identifier || !password) {
			return fail(400, { error: 'Please enter both username/email and password.' });
		}

		try {
			// Find user by either email or username
			const user = await db.query.users.findFirst({
				where: or(eq(users.email, identifier), eq(users.username, identifier))
			});

			if (!user) {
				return fail(400, { error: 'Invalid username or password.' });
			}

			const isValid = await verifyPassword(password, user.passwordHash);

			if (!isValid) {
				return fail(400, { error: 'Invalid username or password.' });
			}

			const sessionToken = generateSessionToken();
			await createSession(sessionToken, user.id);

			cookies.set('session', sessionToken, SESSION_COOKIE_OPTIONS);
		} catch (err) {
			console.error('Production Auth Error:', err);
			return fail(500, { error: 'An unexpected authentication error occurred.' });
		}

		throw redirect(302, validateReturnTo(returnTo));
	}
};
