import { beforeEach, describe, expect, it, vi } from 'vitest';

const picker = vi.hoisted(() => ({
	getPickerRecommendation: vi.fn(),
	recordPickerEvent: vi.fn()
}));

vi.mock('$lib/server/picker', () => picker);

import { POST as postEvent } from './events/+server';
import { GET as getRecommendation, POST as postRecommendation } from './recommend/+server';

const MOVIE_ID = '3f2b8c1e-5a7d-4e6f-9b0a-1c2d3e4f5a6b';
const USER = { id: 'user-1', role: 'member' };

function jsonRequest(body: unknown): Request {
	return new Request('http://localhost/api/picker', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

async function callRecommend(body: unknown): Promise<Response> {
	return postRecommendation({
		request: jsonRequest(body),
		locals: { user: USER }
	} as unknown as Parameters<typeof postRecommendation>[0]) as Promise<Response>;
}

async function callEvent(body: unknown): Promise<Response> {
	return postEvent({
		request: jsonRequest(body),
		locals: { user: USER }
	} as unknown as Parameters<typeof postEvent>[0]) as Promise<Response>;
}

async function callGetRecommend(query: string): Promise<Response> {
	return getRecommendation({
		url: new URL(`http://localhost/api/picker/recommend${query}`),
		locals: { user: USER }
	} as unknown as Parameters<typeof getRecommendation>[0]) as Promise<Response>;
}

beforeEach(() => {
	picker.getPickerRecommendation.mockReset().mockResolvedValue(null);
	picker.recordPickerEvent.mockReset().mockResolvedValue(undefined);
});

describe('POST /api/picker/recommend', () => {
	it('rejects invalid filters before touching the service', async () => {
		const response = await callRecommend({ filters: { minRating: 99 } });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'filters.minRating must be a number between 0 and 10.'
		});
		expect(picker.getPickerRecommendation).not.toHaveBeenCalled();
	});

	it('rejects a malformed JSON body instead of silently using defaults', async () => {
		const response = await callRecommend('{not json');

		expect(response.status).toBe(400);
		expect(picker.getPickerRecommendation).not.toHaveBeenCalled();
	});

	it('passes only sanitised input and the signed-in user to the service', async () => {
		await callRecommend({
			sessionId: 'abc-123',
			filters: { minRating: 7, includeAdult: true },
			shownMovieIds: [MOVIE_ID]
		});

		expect(picker.getPickerRecommendation).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: USER.id,
				sessionId: 'abc-123',
				filters: { minRating: 7 },
				shownMovieIds: [MOVIE_ID]
			})
		);
	});
});

describe('GET /api/picker/recommend', () => {
	it('rejects an unknown preset', async () => {
		const response = await callGetRecommend('?preset=EVERYTHING');

		expect(response.status).toBe(400);
		expect(picker.getPickerRecommendation).not.toHaveBeenCalled();
	});

	it('applies a known preset on the server', async () => {
		await callGetRecommend('?preset=CRIME');

		expect(picker.getPickerRecommendation).toHaveBeenCalledWith(
			expect.objectContaining({
				filters: expect.objectContaining({ genres: ['Crime', 'Mystery'] })
			})
		);
	});
});

describe('POST /api/picker/events', () => {
	it('rejects an action outside the supported set', async () => {
		const response = await callEvent({
			sessionId: 'abc',
			movieId: MOVIE_ID,
			action: 'delete_everything'
		});

		expect(response.status).toBe(400);
		expect(picker.recordPickerEvent).not.toHaveBeenCalled();
	});

	it('rejects a movie id that is not a UUID', async () => {
		const response = await callEvent({ sessionId: 'abc', movieId: 'nope', action: 'open' });

		expect(response.status).toBe(400);
		expect(picker.recordPickerEvent).not.toHaveBeenCalled();
	});

	it('records a valid event for the signed-in user', async () => {
		const response = await callEvent({ sessionId: 'abc', movieId: MOVIE_ID, action: 'open' });

		expect(response.status).toBe(200);
		expect(picker.recordPickerEvent).toHaveBeenCalledWith(
			USER.id,
			expect.objectContaining({ movieId: MOVIE_ID, action: 'open' })
		);
	});
});
