import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// The hosting target is chosen by the build platform: Netlify sets NETLIFY=true,
// every other build (Vercel, local, CI) keeps the Vercel adapter verified in V3.
const { default: adapter } = process.env.NETLIFY
	? await import('@sveltejs/adapter-netlify')
	: await import('@sveltejs/adapter-vercel');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		// SvelteKit validates form-action origins by default. Keep the trusted
		// origin list empty so mutations fail closed on every deployment host.
		csrf: {
			trustedOrigins: []
		},

		experimental: {
			tracing: {
				server: true
			},

			instrumentation: {
				server: true
			}
		}
	}
};

export default config;
