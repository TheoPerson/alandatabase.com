import 'dotenv/config';
import { sentrySvelteKit } from '@sentry/sveltekit';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	define: {
		// Netlify sets CONTEXT only during the build. Each deploy context is built separately,
		// so baking it in is how the server learns whether it is a preview deployment.
		__NETLIFY_DEPLOY_CONTEXT__: JSON.stringify(process.env.CONTEXT ?? '')
	},
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
		// Database-backed tests boot an in-memory PostgreSQL (PGlite/WASM) per file; under
		// parallel load that can exceed the 10s default hook timeout.
		hookTimeout: 60_000,
		setupFiles: ['./tests/setup-unit.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
