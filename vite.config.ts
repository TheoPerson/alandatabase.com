import 'dotenv/config';
import { sentrySvelteKit } from '@sentry/sveltekit';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	server: {
		// Allow local verification with the same hostnames used by Vercel.
		allowedHosts: [
			'alandatabase.com',
			'www.alandatabase.com',
			'api.alandatabase.com',
			'auth.alandatabase.com',
			'status.alandatabase.com',
			'alans-database.vercel.app'
		]
	},
	plugins: [
		sentrySvelteKit({
			org: 'alandatabase',
			project: 'javascript-sveltekit'
		}),
		tailwindcss(),
		sveltekit()
	],
	ssr: {
		external: ['@electric-sql/pglite']
	},
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
