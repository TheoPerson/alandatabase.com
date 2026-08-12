import { db } from './index.js';
import { seedInitialData } from './seed.js';

let migratingPromise: Promise<void> | null = null;

export async function ensureTablesExist() {
	if (migratingPromise) return migratingPromise;

	migratingPromise = (async () => {
		// In production with Neon, we assume the schema is pushed via `pnpm db:push`
		// and we do not run automatic migrations on server startup to avoid connection spikes.

		try {
			await seedInitialData();
		} catch (err) {
			console.warn('Seed warning:', err);
		}
	})();

	return migratingPromise;
}
