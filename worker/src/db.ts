import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/lib/server/db/schema.js';

type WorkerDatabase = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | null = null;
let db: WorkerDatabase | null = null;

/**
 * Create the worker connection lazily so `--help` and invalid CLI commands do
 * not initialize a database client. Worker mutations remain explicit operator
 * actions and never reuse SvelteKit runtime state.
 */
export function getWorkerDatabase(): WorkerDatabase {
	if (db) return db;

	const connectionString = process.env.WORKER_DATABASE_URL?.trim();

	if (!connectionString) {
		throw new Error('WORKER_DATABASE_URL is required for worker database commands.');
	}

	client = postgres(connectionString, { prepare: false, max: 2 });
	db = drizzle(client, { schema });
	return db;
}

export async function closeWorkerDatabase(): Promise<void> {
	if (client) await client.end();
	client = null;
	db = null;
}

export { schema };
