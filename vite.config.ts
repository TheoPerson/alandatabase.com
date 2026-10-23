import 'dotenv/config';
import { sentrySvelteKit } from '@sentry/sveltekit';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

// Hostnames the dev and preview servers answer to. Production hostnames allow local verification;
// PREVIEW_ALLOWED_HOSTS (comma-separated, never committed) adds a private tunnel host such as a
// Tailscale *.ts.net name without hard-coding a personal machine name in the repository.
const allowedHosts = [
	'alandatabase.com',
	'www.alandatabase.com',
	'api.alandatabase.com',
	'auth.alandatabase.com',
	'status.alandatabase.com',
	'alans-database.vercel.app',
	...(process.env.PREVIEW_ALLOWED_HOSTS ?? '')
		.split(',')
		.map((host) => host.trim())
		.filter(Boolean)
];

export default defineConfig({
	define: {
		// Netlify sets CONTEXT only during the build. Each deploy context is built separately,
		// so baking it in is how the server learns whether it is a preview deployment.
		__NETLIFY_DEPLOY_CONTEXT__: JSON.stringify(process.env.CONTEXT ?? '')
	},
	server: { allowedHosts },
	// The preview server is what a private tunnel (Tailscale Serve) reaches; same allow-list.
	preview: { allowedHosts },
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
