import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	verifyPassword,
	hashPassword,
	createSession,
	generateSessionToken,
	SESSION_COOKIE_OPTIONS
} from '$lib/server/auth';
import { validateReturnTo } from '$lib/server/auth/cinema-access';
import { isInitialOwnerSetupAvailable } from '$lib/server/auth/owner-setup';
import { logServerError } from '$lib/server/security/logging';
import { consumeRateLimit } from '$lib/server/security/rate-limit';
import { LOGIN_ACCOUNT_POLICY, LOGIN_IP_POLICY } from '$lib/server/security/rate-limit-policy';
import { eq, or } from 'drizzle-orm';
import { parseUserRole } from '$lib/server/auth/permissions';

let dummyPasswordHashPromise: Promise<string> | null = null;

function getDummyPasswordHash() {
	dummyPasswordHashPromise ??= hashPassword(crypto.randomUUID());
	return dummyPasswordHashPromise;
}

export async function load({ locals, url }) {
	const returnTo = url.searchParams.get('returnTo');
	if (locals.user) {
		throw redirect(302, validateReturnTo(returnTo));
	}
	return { returnTo, allowSetup: await isInitialOwnerSetupAvailable() };
}

export const actions = {
	login: async ({ request, cookies, url, getClientAddress, setHeaders }) => {
		const formData = await request.formData();
		const identifier = formData.get('identifier')?.toString().trim().toLowerCase();
		const password = formData.get('password')?.toString();
		const returnTo = url.searchParams.get('returnTo');

		if (!identifier || !password) {
			return fail(400, { error: 'Please enter both username/email and password.' });
		}
		if (identifier.length > 254 || password.length > 128) {
			return fail(400, { error: 'Invalid username or password.' });
		}

		try {
			const [ipLimit, accountLimit] = await Promise.all([
				consumeRateLimit(getClientAddress(), LOGIN_IP_POLICY),
				consumeRateLimit(identifier, LOGIN_ACCOUNT_POLICY)
			]);

			if (!ipLimit.allowed || !accountLimit.allowed) {
				const retryAfter = Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds);
				setHeaders({ 'retry-after': String(retryAfter) });
				return fail(429, {
					error: 'Too many sign-in attempts. Please wait before trying again.'
				});
			}

			// Find user by either email or username
			const user = await db.query.users.findFirst({
				where: or(eq(users.email, identifier), eq(users.username, identifier))
			});

			// Always execute scrypt so unknown and disabled accounts do not expose a
			// useful timing distinction to a remote attacker.
			const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
			const isValid = await verifyPassword(password, passwordHash);

			if (!user || !isValid || user.disabledAt || !parseUserRole(user.role)) {
				return fail(400, { error: 'Invalid username or password.' });
			}

			const sessionToken = generateSessionToken();
			await createSession(sessionToken, user.id);

			cookies.set('session', sessionToken, SESSION_COOKIE_OPTIONS);
		} catch (err) {
			logServerError('Authentication failed', err);
			return fail(500, { error: 'An unexpected authentication error occurred.' });
		}

		throw redirect(302, validateReturnTo(returnTo));
	}
};
