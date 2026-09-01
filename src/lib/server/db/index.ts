import dotenv from 'dotenv';

dotenv.config();

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { building } from '$app/environment';
import { resolveDatabaseUrl } from './database-url.js';

// postgres-js connects lazily. SvelteKit still imports server modules while
// building, so use an inert, unreachable URL solely to construct the client
// when no runtime database is expected to be queried.
const connectionString = resolveDatabaseUrl(process.env, building);

// Single instance pattern for serverless environments
declare global {
	var __db__: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

let dbInstance: ReturnType<typeof drizzle<typeof schema>>;

if (process.env.NODE_ENV === 'production') {
	const client = postgres(connectionString, { prepare: false, max: 2 });
	dbInstance = drizzle(client, { schema });
} else {
	if (!globalThis.__db__) {
		const client = postgres(connectionString, { prepare: false, max: 2 });
		globalThis.__db__ = drizzle(client, { schema });
	}
	dbInstance = globalThis.__db__;
}

export const db = dbInstance;
export { schema };
