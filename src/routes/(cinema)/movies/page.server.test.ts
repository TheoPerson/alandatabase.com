import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getTopRatedMovies, getTrendingMovies, toggleWatchlist } = vi.hoisted(() => ({
	getTopRatedMovies: vi.fn(),
	getTrendingMovies: vi.fn(),
	toggleWatchlist: vi.fn()
}));

vi.mock('$lib/server/services/movie.service', () => ({ getTopRatedMovies, getTrendingMovies }));
vi.mock('$lib/server/services/interaction.service', () => ({ toggleWatchlist }));

import { actions, load } from './+page.server';

describe('movie landing personal access', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getTrendingMovies.mockResolvedValue([]);
		getTopRatedMovies.mockResolvedValue([]);
	});

	it.each(['admin', 'member'])('hides and denies owner watchlist features for %s', async (role) => {
		const locals = { user: { id: 'user-id', role } };
		const pageData = await load({ locals } as any);
		const formData = vi.fn();
		const actionResult = await actions.toggleWatchlist({
			locals,
			request: { formData }
		} as any);

		expect(pageData.user).toBeNull();
		expect(actionResult).toMatchObject({ status: 403 });
		expect(formData).not.toHaveBeenCalled();
		expect(toggleWatchlist).not.toHaveBeenCalled();
	});

	it('exposes personal controls to the owner', async () => {
		const user = { id: 'owner-id', role: 'owner' };
		const pageData = await load({ locals: { user } } as any);

		expect(pageData.user).toBe(user);
	});
});
