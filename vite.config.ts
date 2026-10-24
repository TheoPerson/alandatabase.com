import { sentrySvelteKit } from '@sentry/sveltekit';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		sentrySvelteKit({
			org: 'alandatabase',
			project: 'javascript-sveltekit'
		}),
		sveltekit()
	],
	ssr: {
		external: ['@electric-sql/pglite']
	},
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		// The postgres client is lazy: a placeholder URL lets pure-logic tests import DB-backed modules
		env: { DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://test:test@localhost:5432/test' },
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
