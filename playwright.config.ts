import { defineConfig } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseUrl || 'http://127.0.0.1:4173';

export default defineConfig({
	testMatch: '**/*.{e2e,spec}.{ts,js}',
	use: {
		baseURL,
		trace: 'retain-on-failure'
	},
	webServer: externalBaseUrl
		? undefined
		: {
				command: 'pnpm build && pnpm preview --host 127.0.0.1',
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000
			}
});
