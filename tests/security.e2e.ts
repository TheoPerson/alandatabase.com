import { expect, test } from '@playwright/test';

test.describe('Browser security boundaries', () => {
	test('logout is POST-only', async ({ request }) => {
		const response = await request.get('/auth/logout', { maxRedirects: 0 });
		expect(response.status()).toBe(405);
		expect(response.headers()['allow']).toBe('POST');
	});

	test('cross-origin form actions fail CSRF validation', async ({ request }) => {
		const response = await request.post('/auth/login?/login', {
			headers: { origin: 'https://attacker.example' },
			form: { identifier: 'nobody', password: 'not-a-password' },
			maxRedirects: 0
		});

		expect(response.status()).toBe(403);
	});

	test('security headers are applied to public and private responses', async ({ request }) => {
		for (const route of ['/', '/status', '/auth/login', '/admin']) {
			const response = await request.get(route, { maxRedirects: 0 });
			const headers = response.headers();
			expect(headers['x-content-type-options'], route).toBe('nosniff');
			expect(headers['x-frame-options'], route).toBe('SAMEORIGIN');
			expect(headers['referrer-policy'], route).toBe('strict-origin-when-cross-origin');
			expect(headers['permissions-policy'], route).toContain('camera=()');
		}
	});
});
