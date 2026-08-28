import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { authAuditEvents, users } from '$lib/server/db/schema';
import {
	hashPassword,
	createSession,
	generateSessionToken,
	SESSION_COOKIE_OPTIONS
} from '$lib/server/auth';
import { validateReturnTo } from '$lib/server/auth/cinema-access';
import { isInitialOwnerSetupAvailable, verifyOwnerSetupKey } from '$lib/server/auth/owner-setup';
import {
	acceptInvitation,
	getInvitationPreview,
	InvitationError,
	normalizeInvitationEmail
} from '$lib/server/auth/invitations';
import { logServerError } from '$lib/server/security/logging';
import { consumeRateLimit } from '$lib/server/security/rate-limit';
import { REGISTER_IP_POLICY } from '$lib/server/security/rate-limit-policy';
import { sql } from 'drizzle-orm';

class OwnerSetupClosedError extends Error {}

export async function load({ locals, url }) {
	const returnTo = url.searchParams.get('returnTo');
	if (locals.user) {
		throw redirect(302, validateReturnTo(returnTo));
	}

	const invitationToken = url.searchParams.get('invite');
	const [allowSetup, invitation] = await Promise.all([
		isInitialOwnerSetupAvailable(),
		getInvitationPreview(invitationToken)
	]);

	return {
		returnTo,
		mode: invitation ? ('invite' as const) : allowSetup ? ('owner' as const) : ('closed' as const),
		invitation,
		invitationToken: invitation ? invitationToken : null
	};
}

export const actions = {
	register: async ({ request, cookies, url, getClientAddress, setHeaders }) => {
		const formData = await request.formData();
		const email = normalizeInvitationEmail(formData.get('email'));
		const username = formData.get('username')?.toString().trim();
		const password = formData.get('password')?.toString();
		const setupKey = formData.get('setupKey')?.toString();
		const invitationToken = formData.get('invitationToken')?.toString();
		const returnTo = url.searchParams.get('returnTo');

		if (!email || !username || !password) {
			return fail(400, { error: 'All fields are required.' });
		}

		const normalizedUsername = username.toLowerCase();
		if (!/^[a-z0-9_-]{3,32}$/.test(normalizedUsername)) {
			return fail(400, {
				error: 'Username must be 3-32 characters using letters, numbers, dashes, or underscores.'
			});
		}

		if (password.length < 12 || password.length > 128) {
			return fail(400, { error: 'Password must be between 12 and 128 characters.' });
		}

		try {
			const rateLimit = await consumeRateLimit(getClientAddress(), REGISTER_IP_POLICY);
			if (!rateLimit.allowed) {
				setHeaders({ 'retry-after': String(rateLimit.retryAfterSeconds) });
				return fail(429, { error: 'Too many setup attempts. Please wait before trying again.' });
			}

			const passwordHash = await hashPassword(password);
			let newUser: typeof users.$inferSelect;

			if (invitationToken) {
				newUser = await acceptInvitation({
					token: invitationToken,
					email,
					username: normalizedUsername,
					displayName: username,
					passwordHash
				});
			} else {
				const allowSetup = await isInitialOwnerSetupAvailable();
				if (!allowSetup || !verifyOwnerSetupKey(setupKey)) {
					return fail(403, { error: 'Owner setup is not available.' });
				}

				newUser = await db.transaction(async (transaction) => {
					// Serialize bootstrap attempts across serverless instances. The key
					// creates only the first owner and is never an authorization fallback.
					await transaction.execute(
						sql`select pg_advisory_xact_lock(hashtext('alan-owner-setup'))`
					);

					const [existingUser] = await transaction.select({ id: users.id }).from(users).limit(1);
					if (existingUser) throw new OwnerSetupClosedError();

					const [createdUser] = await transaction
						.insert(users)
						.values({
							email,
							username: normalizedUsername,
							displayName: username,
							passwordHash,
							role: 'owner'
						})
						.returning();

					if (!createdUser) throw new Error('Owner account was not created.');
					await transaction.insert(authAuditEvents).values({
						actorUserId: createdUser.id,
						targetUserId: createdUser.id,
						action: 'owner.setup'
					});
					return createdUser;
				});
			}

			const sessionToken = generateSessionToken();
			await createSession(sessionToken, newUser.id);

			cookies.set('session', sessionToken, SESSION_COOKIE_OPTIONS);
		} catch (err) {
			if (err instanceof OwnerSetupClosedError) {
				return fail(403, { error: 'Owner setup is already complete.' });
			}
			if (err instanceof InvitationError) {
				return fail(403, { error: 'This invitation is invalid, expired, or already used.' });
			}
			logServerError('Registration failed', err);
			return fail(500, { error: 'Server error during registration.' });
		}

		throw redirect(302, validateReturnTo(returnTo));
	}
};
