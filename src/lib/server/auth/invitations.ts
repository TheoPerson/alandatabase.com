import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { authAuditEvents, authInvites, users } from '$lib/server/db/schema';
import { canAssignRole, type UserRole } from './permissions';

export const INVITATION_EXPIRY_DAYS = 7;

export type InviteRole = Exclude<UserRole, 'owner'>;

export type InvitationState = 'pending' | 'accepted' | 'revoked' | 'expired';

export class InvitationError extends Error {
	constructor(
		public readonly code:
			'invalid' | 'expired' | 'revoked' | 'accepted' | 'email_mismatch' | 'email_in_use',
		message: string
	) {
		super(message);
		this.name = 'InvitationError';
	}
}

export function normalizeInvitationEmail(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const email = value.trim().toLowerCase();
	if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return null;
	return email;
}

export function generateInvitationToken(): string {
	return randomBytes(32).toString('hex');
}

export function hashInvitationToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

function isInvitationToken(token: unknown): token is string {
	return typeof token === 'string' && /^[a-f0-9]{64}$/iu.test(token);
}

export function getInvitationState(
	invite: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
	now = new Date()
): InvitationState {
	if (invite.revokedAt) return 'revoked';
	if (invite.acceptedAt) return 'accepted';
	if (invite.expiresAt.getTime() <= now.getTime()) return 'expired';
	return 'pending';
}

export async function getInvitationPreview(token: unknown, now = new Date()) {
	if (!isInvitationToken(token)) return null;

	try {
		const invite = await db.query.authInvites.findFirst({
			where: eq(authInvites.tokenHash, hashInvitationToken(token)),
			columns: {
				id: true,
				email: true,
				role: true,
				expiresAt: true,
				acceptedAt: true,
				revokedAt: true
			}
		});

		if (!invite || getInvitationState(invite, now) !== 'pending' || !canAssignRole(invite.role)) {
			return null;
		}

		return {
			email: invite.email,
			role: invite.role,
			expiresAt: invite.expiresAt
		};
	} catch {
		return null;
	}
}

export async function createInvitation(input: {
	email: string;
	role: InviteRole;
	invitedBy: string;
	now?: Date;
}) {
	const email = normalizeInvitationEmail(input.email);
	if (!email || !canAssignRole(input.role)) {
		throw new InvitationError('invalid', 'Invitation details are invalid.');
	}

	const now = input.now ?? new Date();
	const token = generateInvitationToken();
	const expiresAt = new Date(now.getTime() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

	const invite = await db.transaction(async (transaction) => {
		await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
		const existingAccount = await transaction.query.users.findFirst({
			where: sql`lower(${users.email}) = ${email}`,
			columns: { id: true }
		});
		if (existingAccount) {
			throw new InvitationError('email_in_use', 'An account already uses this email address.');
		}

		// A newer invitation supersedes older unused links for the same address.
		await transaction
			.update(authInvites)
			.set({ revokedAt: now })
			.where(
				and(
					eq(authInvites.email, email),
					isNull(authInvites.acceptedAt),
					isNull(authInvites.revokedAt)
				)
			);

		const [created] = await transaction
			.insert(authInvites)
			.values({
				email,
				tokenHash: hashInvitationToken(token),
				role: input.role,
				invitedBy: input.invitedBy,
				expiresAt
			})
			.returning();

		if (!created) throw new Error('Invitation was not persisted.');
		await transaction.insert(authAuditEvents).values({
			actorUserId: input.invitedBy,
			inviteId: created.id,
			action: 'invite.created',
			metadata: { role: input.role }
		});
		return created;
	});

	return { invite, token };
}

export async function acceptInvitation(input: {
	token: string;
	email: string;
	username: string;
	displayName: string;
	passwordHash: string;
	now?: Date;
}) {
	if (!isInvitationToken(input.token)) {
		throw new InvitationError('invalid', 'Invitation is invalid.');
	}

	const email = normalizeInvitationEmail(input.email);
	if (!email) throw new InvitationError('invalid', 'Invitation email is invalid.');

	const now = input.now ?? new Date();
	const tokenHash = hashInvitationToken(input.token);

	return db.transaction(async (transaction) => {
		await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
		const invite = await transaction.query.authInvites.findFirst({
			where: eq(authInvites.tokenHash, tokenHash)
		});

		if (!invite || !canAssignRole(invite.role)) {
			throw new InvitationError('invalid', 'Invitation is invalid.');
		}

		const state = getInvitationState(invite, now);
		if (state !== 'pending') {
			throw new InvitationError(state, `Invitation is ${state}.`);
		}
		if (invite.email !== email) {
			throw new InvitationError('email_mismatch', 'Invitation email does not match.');
		}

		const existingUser = await transaction.query.users.findFirst({
			where: sql`lower(${users.email}) = ${email}`,
			columns: { id: true }
		});
		if (existingUser) {
			throw new InvitationError('email_in_use', 'An account already uses this email address.');
		}

		// The conditional update is the one-time claim. Concurrent attempts can
		// never both obtain a returned row; a later insert failure rolls it back.
		const [claimed] = await transaction
			.update(authInvites)
			.set({ acceptedAt: now })
			.where(
				and(
					eq(authInvites.id, invite.id),
					isNull(authInvites.acceptedAt),
					isNull(authInvites.revokedAt),
					gt(authInvites.expiresAt, now)
				)
			)
			.returning({ id: authInvites.id });

		if (!claimed) throw new InvitationError('invalid', 'Invitation has already been claimed.');

		const [createdUser] = await transaction
			.insert(users)
			.values({
				email,
				username: input.username,
				displayName: input.displayName,
				passwordHash: input.passwordHash,
				role: invite.role
			})
			.returning();

		if (!createdUser) throw new Error('Invited account was not created.');

		await transaction
			.update(authInvites)
			.set({ acceptedBy: createdUser.id })
			.where(eq(authInvites.id, invite.id));

		await transaction.insert(authAuditEvents).values({
			actorUserId: createdUser.id,
			targetUserId: createdUser.id,
			inviteId: invite.id,
			action: 'invite.accepted',
			metadata: { role: invite.role }
		});

		return createdUser;
	});
}

export async function listRecentInvitations(limit = 25) {
	return db.query.authInvites.findMany({
		orderBy: [desc(authInvites.createdAt)],
		limit: Math.min(Math.max(limit, 1), 100)
	});
}
