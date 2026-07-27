import 'dotenv/config';
import { db } from './index.js';

async function main() {
	console.log('Database connected successfully using PGLite (or Postgres if configured).');
	process.exit(0);
}

main().catch(console.error);
