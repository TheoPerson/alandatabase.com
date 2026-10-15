import { describe, expect, it } from 'vitest';
import { load as tvshow } from './tvshow/+page.server';
import { load as tvshows } from './tvshows/+page.server';
import { load as tvshowDetail } from './tvshow/[id]/+page.server';
import { load as tvshowsDetail } from './tvshows/[id]/+page.server';

async function redirectOf(run: () => unknown) {
	try {
		await run();
	} catch (thrown) {
		return thrown as { status: number; location: string };
	}
	throw new Error('expected a redirect');
}

describe('TV alias routes', () => {
	it.each([
		['/tvshow', tvshow],
		['/tvshows', tvshows]
	])('%s permanently redirects to /tv', async (_name, load) => {
		expect(await redirectOf(() => (load as () => unknown)())).toMatchObject({
			status: 308,
			location: '/tv'
		});
	});

	it.each([tvshowDetail, tvshowsDetail])('a detail alias keeps the show id', async (load) => {
		const result = await redirectOf(() =>
			(load as (event: unknown) => unknown)({ params: { id: '1396' } })
		);
		expect(result).toMatchObject({ status: 308, location: '/tv/1396' });
	});

	it('does not let an id break out of the /tv path', async () => {
		const result = await redirectOf(() =>
			(tvshowDetail as (event: unknown) => unknown)({ params: { id: '../admin?x=1' } })
		);
		expect(result.location).toBe('/tv/..%2Fadmin%3Fx%3D1');
	});
});
