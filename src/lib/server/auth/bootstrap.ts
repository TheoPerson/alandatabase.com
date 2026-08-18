import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/auth/index';

/**
 * Ensures the admin user exists in the database.
 * If it doesn't, it creates it using predefined credentials.
 * If it does, it makes sure the settings (like adult gate) are ready.
 */
export async function ensureAdminUser() {
	const adminEmail = 'alan@alandatabase.com';
	const adminUsername = 'alan';
	
	// Default admin password for local dev/bootstrap: "CinemaAdmin2026!"
	// IMPORTANT: In production, you would change this from the database directly,
	// but this guarantees you have access right now without creating an account.
	const rawPassword = 'CinemaAdmin2026!';
	
	try {
		const existingUser = await db.query.users.findFirst({
			where: eq(users.email, adminEmail)
		});

		if (!existingUser) {
			console.log('Admin user not found. Creating default admin account...');
			const passwordHash = await hashPassword(rawPassword);
			
			await db.insert(users).values({
				email: adminEmail,
				username: adminUsername,
				passwordHash,
				displayName: 'Alan (Owner)',
				settings: {
					hasAcceptedAdultGate: true,
					isAdmin: true
				}
			});
			console.log('Default admin account created successfully.');
		} else {
			console.log('Admin user exists.');
			// Ensure admin has accepted the adult gate so you don't see it
			const settings = (existingUser.settings as any) || {};
			if (!settings.hasAcceptedAdultGate) {
				await db.update(users)
					.set({ settings: { ...settings, hasAcceptedAdultGate: true } })
					.where(eq(users.id, existingUser.id));
			}
		}
	} catch (err) {
		console.error('Failed to ensure admin user:', err);
	}
}
