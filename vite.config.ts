import { sentrySvelteKit } from '@sentry/sveltekit';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
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
