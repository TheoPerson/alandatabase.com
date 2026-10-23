import { redirect, fail } from '@sveltejs/kit';
import { logServerError } from '$lib/server/security/logging';
import { invalidateOtherSessions, listActiveSessions } from '$lib/server/auth';

export async function load({ locals }) {
	if (!locals.user || !locals.session) {
		throw redirect(302, '/auth/login');
	}

	const activeSessions = await listActiveSessions(locals.user.id);

	return {
		user: locals.user,
		activeSessions: activeSessions.map((session) => ({
			isCurrent: session.id === locals.session?.id,
			createdAt: session.createdAt.toISOString(),
			expiresAt: session.expiresAt.toISOString()
		}))
	};
}

export const actions = {
	revokeOtherSessions: async ({ locals }) => {
		if (!locals.user || !locals.session) {
			return fail(401, { error: 'Unauthorized' });
		}

		try {
			const revokedCount = await invalidateOtherSessions(locals.user.id, locals.session.id);
			return {
				success: true,
				message:
					revokedCount === 0
						? 'No other active sessions were found.'
						: `${revokedCount} other session${revokedCount === 1 ? '' : 's'} revoked.`
			};
		} catch (err) {
			logServerError('Session revocation failed', err);
			return fail(500, { error: 'Failed to revoke other sessions' });
		}
	}
};
