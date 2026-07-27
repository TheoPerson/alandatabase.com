declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				email: string;
				username: string;
				displayName: string | null;
				avatarPath: string | null;
			} | null;
			session: {
				id: string;
				userId: string;
				expiresAt: Date;
			} | null;
			abTests: Record<string, string>;
		}
	}
}

export {};
