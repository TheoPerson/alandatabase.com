import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const scryptAsync = promisify(scrypt);

const SESSION_EXPIRY_DAYS = 30;

export const SESSION_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: process.env.NODE_ENV === 'production' && process.env.VERCEL === '1',
	maxAge: 60 * 60 * 24 * SESSION_EXPIRY_DAYS
};

// Password Hashing with Scrypt (Salt + Hash)
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const buf = (await scryptAsync(password, salt, 64)) as Buffer;
	return `${salt}:${buf.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const [salt, keyHex] = storedHash.split(':');
	if (!salt || !keyHex) return false;

	const keyBuf = Buffer.from(keyHex, 'hex');
	const derivedBuf = (await scryptAsync(password, salt, 64)) as Buffer;

	return timingSafeEqual(keyBuf, derivedBuf);
}

// Session Token Management
export function generateSessionToken(): string {
	return randomBytes(32).toString('hex');
}

export async function createSession(token: string, userId: string) {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

	const [session] = await db
		.insert(sessions)
		.values({
			id: token,
			userId,
			expiresAt
		})
		.returning();

	return session;
}

export async function validateSessionToken(token: string) {
	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, token),
		with: {
			// Get user relation
		}
	});

	if (!session) {
		return { session: null, user: null };
	}

	if (Date.now() >= session.expiresAt.getTime()) {
		await db.delete(sessions).where(eq(sessions.id, session.id));
		return { session: null, user: null };
	}

	const user = await db.query.users.findFirst({
		where: eq(users.id, session.userId)
	});

	if (!user) {
		await db.delete(sessions).where(eq(sessions.id, session.id));
		return { session: null, user: null };
	}

	return { session, user };
}

export async function invalidateSession(sessionId: string) {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}
