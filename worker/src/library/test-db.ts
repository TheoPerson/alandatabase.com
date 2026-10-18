import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { schema } from '../db.js';
import type { WorkerDb } from '../tv/ingest-tv.js';

/** Test-only: an in-memory PostgreSQL with every committed migration applied in order. */
export async function createWorkerTestDatabase() {
	const pg = new PGlite();
	const directory = fileURLToPath(new URL('../../../drizzle/', import.meta.url));
	const migrations = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
	for (const name of migrations) {
		await pg.exec(await readFile(`${directory}${name}`, 'utf8'));
	}
	const db = drizzle(pg, { schema }) as unknown as WorkerDb;
	return { pg, db };
}
