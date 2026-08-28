import { error, fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { AUTH_HOST, isProductionHostname, normalizeHostname } from '$lib/host-routing';
import {
	createInvitation,
	getInvitationState,
	InvitationError
} from '$lib/server/auth/invitations';
import { isOwnerUser } from '$lib/server/auth/owner';
import { canAssignRole } from '$lib/server/auth/permissions';
import { db } from '$lib/server/db';
import { authAuditEvents, authInvites, sessions, users } from '$lib/server/db/schema';
import { consumeRateLimit } from '$lib/server/security/rate-limit';
import { ADMIN_ACCESS_MUTATION_POLICY } from '$lib/server/security/rate-limit-policy';
import { logServerError } from '$lib/server/security/logging';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class AccessMutationError extends Error {}

function requireOwner(locals: App.Locals) {
	if (!locals.user) return fail(401, { error: 'Authentication required.' });
	if (!isOwnerUser(locals.user)) return fail(403, { error: 'Owner access required.' });
	return null;
}

async function consumeOwnerMutationLimit(
	locals: App.Locals,
	setHeaders: (headers: Record<string, string>) => void
) {
	const result = await consumeRateLimit(locals.user!.id, ADMIN_ACCESS_MUTATION_POLICY);
	if (!result.allowed) setHeaders({ 'retry-after': String(result.retryAfterSeconds) });
	return result;
}

export async function load({ locals, url }) {
	if (!locals.user) {
		throw redirect(302, `/auth/login?returnTo=${encodeURIComponent(url.pathname)}`);
	}
	if (!isOwnerUser(locals.user)) {
		throw error(403, 'Owner access required.');
	}

	const now = new Date();
	const [accounts, invitations] = await Promise.all([
		db.query.users.findMany({
			orderBy: [desc(users.createdAt)],
			columns: {
				id: true,
				email: true,
				username: true,
				displayName: true,
				role: true,
				disabledAt: true,
				createdAt: true
			}
		}),
		db.query.authInvites.findMany({
			orderBy: [desc(authInvites.createdAt)],
			limit: 25
		})
	]);

	return {
		currentUserId: locals.user.id,
		users: accounts,
		invitations: invitations.map((invite) => ({
			id: invite.id,
			email: invite.email,
			role: invite.role,
			createdAt: invite.createdAt,
			expiresAt: invite.expiresAt,
			state: getInvitationState(invite, now)
		}))
	};
}

export const actions = {
	createInvitation: async ({ request, locals, url, setHeaders }) => {
		const authFailure = requireOwner(locals);
		if (authFailure) return authFailure;

		try {
			const rateLimit = await consumeOwnerMutationLimit(locals, setHeaders);
			if (!rateLimit.allowed) {
				return fail(429, { error: 'Too many access changes. Try again later.' });
			}

			const formData = await request.formData();
			const email = formData.get('email')?.toString() ?? '';
			const role = formData.get('role')?.toString();
			if (!canAssignRole(role)) {
				return fail(400, { error: 'Choose the admin or member role.' });
			}

			const { token } = await createInvitation({
				email,
				role,
				invitedBy: locals.user!.id
			});

			const base = isProductionHostname(normalizeHostname(url.hostname))
				? `https://${AUTH_HOST}`
				: url.origin;
			const invitationUrl = new URL('/auth/register', base);
			invitationUrl.searchParams.set('invite', token);

			return {
				success: true,
				message: 'Invitation created. Copy this link now; it is not stored in plain text.',
				invitationUrl: invitationUrl.toString()
			};
		} catch (err) {
			if (err instanceof InvitationError && err.code === 'email_in_use') {
				return fail(409, { error: 'An account already uses this email address.' });
			}
			logServerError('Invitation creation failed', err);
			return fail(500, { error: 'Invitation could not be created.' });
		}
	},

	revokeInvitation: async ({ request, locals, setHeaders }) => {
		const authFailure = requireOwner(locals);
		if (authFailure) return authFailure;

		try {
			const rateLimit = await consumeOwnerMutationLimit(locals, setHeaders);
			if (!rateLimit.allowed) return fail(429, { error: 'Too many access changes.' });

			const inviteId = (await request.formData()).get('inviteId')?.toString();
			if (!inviteId || !UUID_PATTERN.test(inviteId)) {
				return fail(400, { error: 'Invitation identifier is invalid.' });
			}

			const revokedAt = new Date();
			const revoked = await db.transaction(async (transaction) => {
				const [invite] = await transaction
					.update(authInvites)
					.set({ revokedAt })
					.where(
						and(
							eq(authInvites.id, inviteId),
							isNull(authInvites.acceptedAt),
							isNull(authInvites.revokedAt)
						)
					)
					.returning({ id: authInvites.id });
				if (!invite) return false;

				await transaction.insert(authAuditEvents).values({
					actorUserId: locals.user!.id,
					inviteId,
					action: 'invite.revoked'
				});
				return true;
			});

			if (!revoked) return fail(409, { error: 'Invitation is no longer pending.' });
			return { success: true, message: 'Invitation revoked.' };
		} catch (err) {
			logServerError('Invitation revocation failed', err);
			return fail(500, { error: 'Invitation could not be revoked.' });
		}
	},

	updateRole: async ({ request, locals, setHeaders }) => {
		const authFailure = requireOwner(locals);
		if (authFailure) return authFailure;

		try {
			const rateLimit = await consumeOwnerMutationLimit(locals, setHeaders);
			if (!rateLimit.allowed) return fail(429, { error: 'Too many access changes.' });

			const formData = await request.formData();
			const userId = formData.get('userId')?.toString();
			const role = formData.get('role')?.toString();
			if (!userId || !UUID_PATTERN.test(userId) || !canAssignRole(role)) {
				return fail(400, { error: 'Account or role is invalid.' });
			}
			if (userId === locals.user!.id) {
				return fail(400, { error: 'The owner role cannot be changed here.' });
			}

			await db.transaction(async (transaction) => {
				const target = await transaction.query.users.findFirst({
					where: eq(users.id, userId),
					columns: { id: true, role: true }
				});
				if (!target || target.role === 'owner') throw new AccessMutationError();

				await transaction
					.update(users)
					.set({ role, updatedAt: new Date() })
					.where(eq(users.id, userId));
				await transaction.insert(authAuditEvents).values({
					actorUserId: locals.user!.id,
					targetUserId: userId,
					action: 'role.changed',
					metadata: { from: target.role, to: role }
				});
			});

			return { success: true, message: 'Role updated.' };
		} catch (err) {
			if (err instanceof AccessMutationError) {
				return fail(400, { error: 'Owner access cannot be reassigned here.' });
			}
			logServerError('Role update failed', err);
			return fail(500, { error: 'Role could not be updated.' });
		}
	},

	setAccountState: async ({ request, locals, setHeaders }) => {
		const authFailure = requireOwner(locals);
		if (authFailure) return authFailure;

		try {
			const rateLimit = await consumeOwnerMutationLimit(locals, setHeaders);
			if (!rateLimit.allowed) return fail(429, { error: 'Too many access changes.' });

			const formData = await request.formData();
			const userId = formData.get('userId')?.toString();
			const disabled = formData.get('disabled') === 'true';
			if (!userId || !UUID_PATTERN.test(userId) || userId === locals.user!.id) {
				return fail(400, { error: 'Account state change is invalid.' });
			}

			await db.transaction(async (transaction) => {
				const target = await transaction.query.users.findFirst({
					where: eq(users.id, userId),
					columns: { id: true, role: true }
				});
				if (!target || target.role === 'owner') throw new AccessMutationError();

				await transaction
					.update(users)
					.set({ disabledAt: disabled ? new Date() : null, updatedAt: new Date() })
					.where(eq(users.id, userId));

				if (disabled) {
					await transaction
						.update(sessions)
						.set({ revokedAt: new Date() })
						.where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
				}

				await transaction.insert(authAuditEvents).values({
					actorUserId: locals.user!.id,
					targetUserId: userId,
					action: disabled ? 'account.disabled' : 'account.enabled'
				});
			});

			return { success: true, message: disabled ? 'Account disabled.' : 'Account enabled.' };
		} catch (err) {
			if (err instanceof AccessMutationError) {
				return fail(400, { error: 'The owner account cannot be disabled.' });
			}
			logServerError('Account state update failed', err);
			return fail(500, { error: 'Account state could not be updated.' });
		}
	}
};
