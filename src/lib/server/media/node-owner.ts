// The user behind a playback grant, re-read from the database on every request: a grant stops
// working as soon as the account is no longer the owner or is disabled.

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { isOwnerUser } from '../auth/owner';
import { parseUserRole } from '../auth/permissions';

export async function loadActiveOwner(userId: string): Promise<App.Locals['user']> {
	const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
	if (!row || row.disabledAt) return null;
	const role = parseUserRole(row.role);
	if (!role) return null;
	const user = {
		id: row.id,
		email: row.email,
		username: row.username,
		displayName: row.displayName,
		avatarPath: row.avatarPath,
		role,
		disabledAt: row.disabledAt,
		settings: (row.settings as Record<string, unknown>) || {}
	};
	return isOwnerUser(user) ? user : null;
}
