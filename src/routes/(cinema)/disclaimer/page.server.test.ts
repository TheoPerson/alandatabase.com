import { beforeEach, describe, expect, it, vi } from 'vitest';

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('$lib/server/db', () => ({
	db: { update: () => ({ set: () => ({ where: (w: unknown) => update(w) }) }) }
}));

import { actions, load } from './+page.server';

const user = { id: 'u1', role: 'owner', settings: {} };
const form = (fields: Record<string, string>) => ({
	formData: async () => ({ get: (key: string) => fields[key] ?? null })
});
async function redirectOf(run: () => unknown) {
	try {
		await run();
	} catch (thrown) {
		return thrown as { status: number; location: string };
	}
	throw new Error('expected a redirect');
}

beforeEach(() => vi.clearAllMocks());

describe('content notice', () => {
	it('returns to the page that was asked for after accepting', async () => {
		const result = await redirectOf(() =>
			actions.accept({
				locals: { user },
				request: form({ returnTo: '/my/films?tab=stats' })
			} as never)
		);
		expect(result).toMatchObject({ status: 302, location: '/my/films?tab=stats' });
		expect(update).toHaveBeenCalled();
	});

	it('never redirects to another site', async () => {
		for (const returnTo of ['https://evil.example/x', '//evil.example', 'javascript:alert(1)']) {
			const result = await redirectOf(() =>
				actions.accept({ locals: { user }, request: form({ returnTo }) } as never)
			);
			expect(result.location).toBe('/movies');
		}
	});

	it('hands the requested page to the form and skips the notice once accepted', async () => {
		const data = await (load as (event: unknown) => Promise<{ returnTo: string }>)({
			locals: { user },
			url: new URL('https://alandatabase.com/disclaimer?returnTo=%2Fmy%2Flists')
		});
		expect(data.returnTo).toBe('/my/lists');

		const accepted = { ...user, settings: { hasAcceptedAdultGate: true } };
		const result = await redirectOf(() =>
			(load as (event: unknown) => unknown)({
				locals: { user: accepted },
				url: new URL('https://alandatabase.com/disclaimer?returnTo=%2Fmy%2Flists')
			})
		);
		expect(result.location).toBe('/my/lists');
	});
});
