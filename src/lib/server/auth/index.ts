import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';
import { parseUserRole } from './permissions';

const scryptAsync = promisify(scrypt);

const SESSION_EXPIRY_DAYS = 30;
const IS_VERCEL_RUNTIME = process.env.VERCEL === '1';
const IS_VERCEL_PRODUCTION = IS_VERCEL_RUNTIME && process.env.VERCEL_ENV === 'production';

export const SESSION_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: process.env.NODE_ENV === 'production' || IS_VERCEL_RUNTIME,
	// The login portal is a first-class subdomain. Share only the hardened
	// session cookie with sibling application/API hosts in Vercel Production.
	// Preview deployments must retain a host-only cookie because their
	// `*.vercel.app` hostname cannot set a cookie for alandatabase.com.
	domain: IS_VERCEL_PRODUCTION ? '.alandatabase.com' : undefined,
	maxAge: 60 * 60 * 24 * SESSION_EXPIRY_DAYS
};

export const SESSION_COOKIE_DELETE_OPTIONS = {
	path: SESSION_COOKIE_OPTIONS.path,
	domain: SESSION_COOKIE_OPTIONS.domain
};

// Password Hashing with Scrypt (Salt + Hash)
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const buf = (await scryptAsync(password, salt, 64)) as Buffer;
	return `${salt}:${buf.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const [salt, keyHex] = storedHash.split(':');
	if (!salt || !keyHex || !/^[a-f0-9]{128}$/i.test(keyHex)) return false;

	const keyBuf = Buffer.from(keyHex, 'hex');
	const derivedBuf = (await scryptAsync(password, salt, 64)) as Buffer;

	if (keyBuf.length !== derivedBuf.length) return false;
	return timingSafeEqual(keyBuf, derivedBuf);
}

// Session Token Management
export function generateSessionToken(): string {
	return randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function createSession(token: string, userId: string) {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

	const [session] = await db
		.insert(sessions)
		.values({
			id: hashSessionToken(token),
			userId,
			expiresAt
		})
		.returning();

	return session;
}

export async function validateSessionToken(token: string) {
	if (!/^[a-f0-9]{64}$/i.test(token)) {
		return { session: null, user: null };
	}

	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, hashSessionToken(token)),
		with: {
			// Get user relation
		}
	});

	if (!session) {
		return { session: null, user: null };
	}

	if (Date.now() >= session.expiresAt.getTime()) {
		return { session: null, user: null };
	}

	const user = await db.query.users.findFirst({
		where: eq(users.id, session.userId)
	});

	const role = parseUserRole(user?.role);
	if (!user || !role || user.disabledAt || session.revokedAt) {
		return { session: null, user: null };
	}

	return {
		session,
		user: { ...user, role }
	};
}

export async function invalidateSession(sessionId: string) {
	await db
		.update(sessions)
		.set({ revokedAt: new Date() })
		.where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function invalidateOtherSessions(userId: string, currentSessionId: string) {
	const revoked = await db
		.update(sessions)
		.set({ revokedAt: new Date() })
		.where(
			and(
				eq(sessions.userId, userId),
				ne(sessions.id, currentSessionId),
				isNull(sessions.revokedAt)
			)
		)
		.returning({ id: sessions.id });
	return revoked.length;
}

export async function invalidateAllUserSessions(userId: string) {
	const revoked = await db
		.update(sessions)
		.set({ revokedAt: new Date() })
		.where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
		.returning({ id: sessions.id });
	return revoked.length;
}

export async function listActiveSessions(userId: string, now = new Date()) {
	return db.query.sessions.findMany({
		where: and(
			eq(sessions.userId, userId),
			isNull(sessions.revokedAt),
			gt(sessions.expiresAt, now)
		),
		orderBy: [desc(sessions.createdAt)],
		columns: {
			id: true,
			createdAt: true,
			expiresAt: true
		}
	});
}
