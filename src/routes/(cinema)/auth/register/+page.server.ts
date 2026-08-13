import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	hashPassword,
	createSession,
	generateSessionToken,
	SESSION_COOKIE_OPTIONS
} from '$lib/server/auth';
import { eq, or } from 'drizzle-orm';
import { notifyUserRegistered } from '$lib/server/services/telegram.service';

export async function load({ locals }) {
	if (locals.user) {
		throw redirect(302, '/my/films');
	}
	return {};
}

export const actions = {
	register: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString().trim().toLowerCase();
		const username = formData.get('username')?.toString().trim();
		const password = formData.get('password')?.toString();

		if (!email || !username || !password) {
			return fail(400, { error: 'All fields are required.' });
		}

		if (password.length < 6) {
			return fail(400, { error: 'Password must be at least 6 characters.' });
		}

		try {
			// Check if username or email exists
			const existing = await db.query.users.findFirst({
				where: or(eq(users.email, email), eq(users.username, username))
			});

			if (existing) {
				return fail(400, { error: 'Username or Email is already registered.' });
			}

			const passwordHash = await hashPassword(password);

			const [newUser] = await db
				.insert(users)
				.values({
					email,
					username,
					displayName: username,
					passwordHash
				})
				.returning();

			const sessionToken = generateSessionToken();
			await createSession(sessionToken, newUser.id);

			cookies.set('session', sessionToken, SESSION_COOKIE_OPTIONS);

			// Trigger Telegram notification
			notifyUserRegistered(newUser.username, newUser.email).catch(() => {});
		} catch (err) {
			console.error('Registration failed:', err);
			return fail(500, { error: 'Server error during registration.' });
		}

		throw redirect(302, '/my/films');
	}
};
