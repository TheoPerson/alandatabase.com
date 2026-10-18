import { beforeEach, describe, expect, it, vi } from 'vitest';

const tvDb = vi.hoisted(() => ({ getTvShowByTmdbId: vi.fn() }));
const shows = vi.hoisted(() => ({
	getShowInteraction: vi.fn(),
	setShowFlag: vi.fn(),
	isShowFlag: (value: string | undefined) => value === 'watchlist' || value === 'favorite'
}));
const repo = vi.hoisted(() => ({
	getMediaFile: vi.fn(),
	getPlayableForMovie: vi.fn(),
	getPlayableForEpisodes: vi.fn(),
	getProgress: vi.fn()
}));
vi.mock('$lib/server/services/tv-db.service', () => tvDb);
vi.mock('$lib/server/services/show-interaction.service', () => shows);
vi.mock('$lib/server/media/repository', () => repo);

import { actions, load } from './+page.server';
import { TOP_50_IMDB_TV } from '$lib/server/services/tv.service';

const member = { id: '00000000-0000-4000-8000-0000000000bb', role: 'member', username: 'guest' };
const chartId = TOP_50_IMDB_TV[0].tmdbId;

const runLoad = (tmdbId: string, user: unknown = null) =>
	(load as (event: unknown) => Promise<any>)({ params: { id: tmdbId }, locals: { user } });

function submit(tmdbId: string, fields: Record<string, string>, user: unknown = member) {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) body.set(key, value);
	const request = new Request(`http://localhost/tv/${tmdbId}?/logInteraction`, {
		method: 'POST',
		body
	});
	return (actions.logInteraction as (event: unknown) => Promise<any>)({
		request,
		params: { id: tmdbId },
		locals: { user }
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	tvDb.getTvShowByTmdbId.mockResolvedValue(null);
	shows.getShowInteraction.mockResolvedValue({ watchlist: true, favorite: false });
	shows.setShowFlag.mockResolvedValue({ watchlist: true, favorite: true });
});

describe('series page interaction state', () => {
	it('reads the saved flags for a signed-in user', async () => {
		const data = await runLoad(String(chartId), member);
		expect(data.signedIn).toBe(true);
		expect(data.interaction).toEqual({ watchlist: true, favorite: false });
		expect(shows.getShowInteraction).toHaveBeenCalledWith(member.id, chartId);
	});

	it('reads nothing for a visitor', async () => {
		const data = await runLoad(String(chartId));
		expect(data.signedIn).toBe(false);
		expect(data.interaction).toBeNull();
		expect(shows.getShowInteraction).not.toHaveBeenCalled();
	});

	it('still renders the page when the flags cannot be read', async () => {
		shows.getShowInteraction.mockRejectedValue(new Error('db down'));
		const data = await runLoad(String(chartId), member);
		expect(data.interaction).toBeNull();
		expect(data.show.tmdbId).toBe(chartId);
	});
});

describe('series watchlist and favourite action', () => {
	it('refuses a visitor', async () => {
		const result = await submit(String(chartId), { type: 'watchlist', value: 'true' }, null);
		expect(result.status).toBe(401);
		expect(shows.setShowFlag).not.toHaveBeenCalled();
	});

	it('rejects an unknown type or a non-boolean value', async () => {
		expect((await submit(String(chartId), { type: 'watched', value: 'true' })).status).toBe(400);
		expect((await submit(String(chartId), { type: 'favorite', value: 'yes' })).status).toBe(400);
		expect(shows.setShowFlag).not.toHaveBeenCalled();
	});

	it('refuses a series no standard page shows (unknown or quarantined)', async () => {
		const result = await submit('999999999', { type: 'watchlist', value: 'true' });
		expect(result.status).toBe(404);
		expect(shows.setShowFlag).not.toHaveBeenCalled();
		expect((await submit('abc', { type: 'watchlist', value: 'true' })).status).toBe(404);
	});

	it('saves a chart series and returns the saved state', async () => {
		const result = await submit(String(chartId), { type: 'favorite', value: 'true' });
		expect(shows.setShowFlag).toHaveBeenCalledWith(member.id, chartId, 'favorite', true);
		expect(result).toEqual({ success: true, interaction: { watchlist: true, favorite: true } });
	});

	it('saves a series known only to the database', async () => {
		tvDb.getTvShowByTmdbId.mockResolvedValue({ tmdbId: 250307 });
		await submit('250307', { type: 'watchlist', value: 'false' });
		expect(shows.setShowFlag).toHaveBeenCalledWith(member.id, 250307, 'watchlist', false);
	});

	it('reports a failed save', async () => {
		shows.setShowFlag.mockRejectedValue(new Error('db down'));
		const result = await submit(String(chartId), { type: 'watchlist', value: 'true' });
		expect(result.status).toBe(500);
	});
});
