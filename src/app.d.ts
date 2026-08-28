declare global {
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
