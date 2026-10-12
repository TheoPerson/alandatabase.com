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
			project: 'javascript-sveltekit',
			telemetry: false
		}),
		tailwindcss(),
		sveltekit()
	],
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		setupFiles: ['./tests/setup-unit.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
