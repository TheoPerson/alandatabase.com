import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set. Please configure it in your environment variables.');
}

// Single instance pattern for serverless environments
declare global {
	var __db__: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

let dbInstance: ReturnType<typeof drizzle<typeof schema>>;

if (process.env.NODE_ENV === 'production') {
	const client = postgres(connectionString);
	dbInstance = drizzle(client, { schema });
} else {
	if (!globalThis.__db__) {
		const client = postgres(connectionString);
		globalThis.__db__ = drizzle(client, { schema });
	}
	dbInstance = globalThis.__db__;
}

export const db = dbInstance;
export { schema };
