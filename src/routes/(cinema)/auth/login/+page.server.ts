import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	verifyPassword,
	createSession,
	generateSessionToken,
	SESSION_COOKIE_OPTIONS
} from '$lib/server/auth';
import { eq, or } from 'drizzle-orm';

export async function load({ locals }) {
	if (locals.user) {
		throw redirect(302, '/my/films');
	}
	return {};
}

export const actions = {
	login: async ({ request, cookies }) => {
		const formData = await request.formData();
		const identifier = formData.get('identifier')?.toString().trim().toLowerCase();
		const password = formData.get('password')?.toString();

		if (!identifier || !password) {
			return fail(400, { error: 'Username/Email and password are required.' });
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
			console.error('Login failed:', err);
			return fail(500, { error: 'Server error during login.' });
		}

		throw redirect(302, '/my/films');
	}
};
