import { db } from './index.js';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { seedInitialData } from './seed.js';
import { migrate } from 'drizzle-orm/pglite/migrator';

let migratingPromise: Promise<void> | null = null;

export async function ensureTablesExist() {
	if (migratingPromise) return migratingPromise;

	migratingPromise = (async () => {
		try {
			console.log('⚡ Checking database schema migrations...');
			const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
			await migrate(db as any, { migrationsFolder });
			console.log('✅ Database schema initialized via Drizzle Migrator!');
		} catch (err) {
			console.error('⚠️ Drizzle migration failed, falling back to manual creation:', err);
		}

		try {
			await seedInitialData();
		} catch (err) {
			console.warn('Seed warning:', err);
		}
	})();

	return migratingPromise;
}

