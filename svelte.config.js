import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

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
		// PREVIEW_TRUSTED_ORIGINS (comma-separated, set only for a local build behind a private
		// tunnel such as Tailscale Serve, never committed) admits that tunnel's https origin.
		csrf: {
			trustedOrigins: (process.env.PREVIEW_TRUSTED_ORIGINS ?? '')
				.split(',')
				.map((origin) => origin.trim())
				.filter((origin) => /^https:\/\/[a-z0-9.-]+$/u.test(origin))
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
