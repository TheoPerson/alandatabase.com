import { describe, expect, it, vi } from 'vitest';

describe('AI chat privacy boundary', () => {
	it('fails closed without contacting an external model', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const { POST } = await import('./+server');

		await expect(POST({} as Parameters<typeof POST>[0])).rejects.toMatchObject({ status: 410 });
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
