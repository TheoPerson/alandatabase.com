import { seedInitialData } from './src/lib/server/db/seed.js';
seedInitialData()
	.then(() => {
		console.log('Done!');
		process.exit(0);
	})
	.catch(console.error);
