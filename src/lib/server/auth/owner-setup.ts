import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createHash, timingSafeEqual } from 'node:crypto';

const MINIMUM_SETUP_KEY_LENGTH = 32;

function normalizeSetupKey(value: string | undefined): string | null {
	value = value?.trim();
	return value && value.length >= MINIMUM_SETUP_KEY_LENGTH ? value : null;
}

function configuredSetupKey(): string | null {
	return normalizeSetupKey(process.env.OWNER_SETUP_KEY);
}

export function verifyOwnerSetupKey(
	candidate: unknown,
	configured: string | null = configuredSetupKey()
): boolean {
	configured = normalizeSetupKey(configured ?? undefined);
	if (!configured || typeof candidate !== 'string' || !candidate) return false;

	const configuredDigest = createHash('sha256').update(configured, 'utf8').digest();
	const candidateDigest = createHash('sha256').update(candidate, 'utf8').digest();
	return timingSafeEqual(configuredDigest, candidateDigest);
}

export async function isInitialOwnerSetupAvailable(): Promise<boolean> {
	if (!configuredSetupKey()) return false;

	try {
		const [existingUser] = await db.select({ id: users.id }).from(users).limit(1);
		return !existingUser;
	} catch {
		// Setup availability fails closed if the database cannot prove that the
		// account table is empty.
		return false;
	}
}
