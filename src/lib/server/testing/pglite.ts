import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../db/schema';

/**
 * An in-memory PostgreSQL (PGlite) with every committed migration applied in
 * order. Lets tests exercise real SQL, including Drizzle's relational query
 * builder, which a mock driver cannot validate.
 */
export async function createMigratedTestDatabase() {
	const pg = new PGlite();
	const directory = resolve(process.cwd(), 'drizzle');
	const migrations = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();

	for (const name of migrations) {
		await pg.exec(await readFile(resolve(directory, name), 'utf8'));
	}

	return { pg, database: drizzle(pg, { schema }) };
}
