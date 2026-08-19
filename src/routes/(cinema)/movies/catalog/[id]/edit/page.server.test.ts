import { beforeEach, describe, expect, it, vi } from 'vitest';

const spies = vi.hoisted(() => ({
	getMovieById: vi.fn(),
	findFirst: vi.fn(),
	update: vi.fn(),
	set: vi.fn(),
	where: vi.fn()
}));

vi.mock('$lib/server/services/movie.service', () => ({
	getMovieById: spies.getMovieById
}));

vi.mock('$lib/server/db', () => ({
	db: {
		query: { movies: { findFirst: spies.findFirst } },
		update: spies.update
	}
}));

import { actions } from './+page.server';

const MOVIE_ID = '00000000-0000-4000-8000-000000000001';

function editRequest() {
	const form = new FormData();
	form.set('title', 'Private title');
	form.set('originalTitle', 'Official original');
	form.set('releaseDate', '1999-03-31');
	form.set('overview', 'Private overview');
	form.set('isLocked', 'on');

	return new Request(`http://localhost/movies/catalog/${MOVIE_ID}/edit`, {
		method: 'POST',
		body: form
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubEnv('OWNER_USER_IDS', 'owner');
	vi.stubEnv('OWNER_EMAILS', '');
	spies.getMovieById.mockResolvedValue({ id: MOVIE_ID, title: 'Private title' });
	spies.findFirst.mockResolvedValue({
		id: MOVIE_ID,
		title: 'Official title',
		originalTitle: 'Official original',
		releaseDate: '1999-03-31',
		overview: 'Official overview',
		localOverrides: {
			title: 'Private title',
			overview: 'Private overview',
			customVideoUrl: 'https://untrusted.example/embed'
		}
	});
	spies.update.mockReturnValue({ set: spies.set });
	spies.set.mockReturnValue({ where: spies.where });
	spies.where.mockResolvedValue(undefined);
});

describe('catalog edit override privacy', () => {
	it('rejects authenticated non-owner users before reading catalog data', async () => {
		vi.stubEnv('OWNER_USER_IDS', 'someone-else');

		await expect(
			actions.default({
				request: editRequest(),
				params: { id: MOVIE_ID },
				locals: { user: { id: 'viewer' } }
			} as never)
		).rejects.toMatchObject({ status: 403 });

		expect(spies.getMovieById).not.toHaveBeenCalled();
		expect(spies.findFirst).not.toHaveBeenCalled();
		expect(spies.update).not.toHaveBeenCalled();
	});

	it('preserves whitelisted overrides without persisting legacy source fields', async () => {
		await expect(
			actions.default({
				request: editRequest(),
				params: { id: MOVIE_ID },
				locals: { user: { id: 'owner' } }
			} as never)
		).rejects.toMatchObject({ status: 302 });

		expect(spies.set).toHaveBeenCalledWith(
			expect.objectContaining({
				localOverrides: {
					title: 'Private title',
					overview: 'Private overview'
				},
				isLocked: true
			})
		);
		expect(JSON.stringify(spies.set.mock.calls[0][0])).not.toContain('customVideoUrl');
	});

	it('rejects a direct POST to a quarantined movie before reading raw overrides', async () => {
		spies.getMovieById.mockResolvedValue(null);

		const result = await actions.default({
			request: editRequest(),
			params: { id: MOVIE_ID },
			locals: { user: { id: 'owner' } }
		} as never);

		expect(result).toMatchObject({ status: 404 });
		expect(spies.findFirst).not.toHaveBeenCalled();
		expect(spies.update).not.toHaveBeenCalled();
	});
});
