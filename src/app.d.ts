declare global {
	// Replaced at build time (see vite.config.ts) with Netlify's CONTEXT; undefined elsewhere.
	var __NETLIFY_DEPLOY_CONTEXT__: string | undefined;

	namespace App {
		interface Locals {
			user: {
				id: string;
				email: string;
				username: string;
				displayName: string | null;
				avatarPath: string | null;
				role: import('$lib/server/auth/permissions').UserRole;
				disabledAt: Date | null;
				settings: Record<string, any>;
			} | null;
			session: {
				id: string;
				userId: string;
				expiresAt: Date;
				createdAt: Date;
				lastSeenAt: Date;
				revokedAt: Date | null;
			} | null;
			abTests: Record<string, string>;
		}
	}
}

export {};
