import 'dotenv/config';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePgLite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import path from 'node:path';
import fs from 'node:fs';

declare global {
	var __pglite_db__: any | undefined;
}

function createDbClient() {
	if (globalThis.__pglite_db__) {
		return globalThis.__pglite_db__;
	}

	const connectionString = process.env.DATABASE_URL;
	const usePgLite = process.env.USE_PGLITE === 'true' || !connectionString;

	if (!usePgLite && connectionString) {
		try {
			const client = postgres(connectionString);
			globalThis.__pglite_db__ = drizzlePostgres(client, { schema });
			return globalThis.__pglite_db__;
		} catch (err) {
			console.warn('⚠️ Could not connect to PostgreSQL server, falling back to embedded PGlite DB:', err);
		}
	}

	const dataDir = path.resolve(process.cwd(), '.data/cinema_db');
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}
	const pglite = new PGlite(dataDir);
	globalThis.__pglite_db__ = drizzlePgLite(pglite, { schema });
	return globalThis.__pglite_db__;
}

export const db = createDbClient();
export { schema };

