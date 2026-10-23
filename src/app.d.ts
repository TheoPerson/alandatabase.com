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
			// Media node only: the playback grant this request was authenticated with.
			mediaGrant?: string | null;
		}

		// Shallow routing state: the trailer player is open while `player` is set,
		// so Back closes it without leaving the page.
		interface PageState {
			player?: { key: string };
		}
	}
}

export {};
