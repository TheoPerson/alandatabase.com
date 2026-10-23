import { createHash, randomBytes } from 'node:crypto';
import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';
import { parseUserRole } from './permissions';
import { CANONICAL_HOST, isProductionHostname, normalizeHostname } from '$lib/host-routing';
export { hashPassword, verifyPassword } from './password-hash';

const SESSION_EXPIRY_DAYS = 30;
function isSharedCookieHost(hostname: string): boolean {
	const host = normalizeHostname(hostname);
	return host === CANONICAL_HOST || host.endsWith(`.${CANONICAL_HOST}`);
}

// Derived from the request URL on purpose. Hosting platforms differ in what they
// expose to server code at runtime (Netlify does not document NETLIFY, CONTEXT or
// NODE_ENV for functions), so platform environment variables must not decide
// whether the session cookie is Secure or shared.
export function sessionCookieOptions(url: URL) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		// Fail toward Secure: only plain-http local development gets a non-Secure cookie.
		secure:
			url.protocol === 'https:' ||
			isProductionHostname(url.hostname) ||
			process.env.NODE_ENV === 'production',
		// The login portal is a first-class subdomain, so the hardened session cookie is
		// shared across the production hosts. Platform and preview hostnames (for example
		// *.netlify.app) cannot set a cookie for alandatabase.com and stay host-only.
		domain: isSharedCookieHost(url.hostname) ? `.${CANONICAL_HOST}` : undefined,
		maxAge: 60 * 60 * 24 * SESSION_EXPIRY_DAYS
	};
}

// Deleting must repeat the attributes the cookie was set with, or browsers keep it.
export function sessionCookieDeleteOptions(url: URL) {
	const { path, domain, httpOnly, sameSite, secure } = sessionCookieOptions(url);
	return { path, domain, httpOnly, sameSite, secure };
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
