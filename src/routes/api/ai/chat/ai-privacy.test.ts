import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { SQL } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { aiChatSessions } from '$lib/server/db/schema';

const dbSpies = vi.hoisted(() => ({
	aiChatFindFirst: vi.fn(),
	interactionFindMany: vi.fn(),
	reviewFindMany: vi.fn(),
	delete: vi.fn(),
	deleteWhere: vi.fn(),
	update: vi.fn(),
	updateSet: vi.fn(),
	updateWhere: vi.fn(),
	insert: vi.fn(),
	insertValues: vi.fn(),
	searchMovies: vi.fn(),
	generateContent: vi.fn(),
	genAiConstructor: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			aiChatSessions: { findFirst: dbSpies.aiChatFindFirst },
			userMovieInteractions: { findMany: dbSpies.interactionFindMany },
			userReviews: { findMany: dbSpies.reviewFindMany }
		},
		delete: dbSpies.delete,
		update: dbSpies.update,
		insert: dbSpies.insert
	}
}));

vi.mock('$lib/server/services/movie.service', () => ({
	searchMovies: dbSpies.searchMovies
}));

vi.mock('@google/genai', () => ({
	GoogleGenAI: class {
		models = { generateContent: dbSpies.generateContent };

		constructor(options: unknown) {
			dbSpies.genAiConstructor(options);
		}
	},
	Type: {
		OBJECT: 'OBJECT',
		STRING: 'STRING',
		ARRAY: 'ARRAY'
	}
}));

const USER_ID = '00000000-0000-4000-8000-000000000100';
const ORIGINAL_GEMINI_KEY = process.env.GEMINI_API_KEY;

function movieFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: crypto.randomUUID(),
		tmdbId: 1,
		title: 'Standard Movie',
		adult: false,
		keywords: [],
		...overrides
	};
}

function request(body: unknown) {
	return new Request('http://localhost/api/ai/chat', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function cookieJar(existingSessionKey?: string) {
	return {
		get: vi.fn((name: string) => (name === 'ai_chat_session' ? existingSessionKey : undefined)),
		set: vi.fn()
	};
}

function compileSessionPredicate(predicate: SQL) {
	const mockDb = drizzle.mock({ schema });
	return mockDb.select({ id: aiChatSessions.id }).from(aiChatSessions).where(predicate).toSQL();
}

async function callChat(body: unknown, existingSessionKey?: string) {
	process.env.GEMINI_API_KEY = 'test-gemini-key';
	vi.resetModules();
	const { POST } = await import('./+server');
	const cookies = cookieJar(existingSessionKey);
	const response = (await POST({
		request: request(body),
		locals: { user: { id: USER_ID } },
		cookies
	} as unknown as Parameters<typeof POST>[0])) as Response;

	return { response, cookies };
}

beforeEach(() => {
	vi.clearAllMocks();
	dbSpies.aiChatFindFirst.mockResolvedValue(undefined);
	dbSpies.interactionFindMany.mockResolvedValue([]);
	dbSpies.reviewFindMany.mockResolvedValue([]);
	dbSpies.delete.mockReturnValue({ where: dbSpies.deleteWhere });
	dbSpies.deleteWhere.mockResolvedValue(undefined);
	dbSpies.update.mockReturnValue({ set: dbSpies.updateSet });
	dbSpies.updateSet.mockReturnValue({ where: dbSpies.updateWhere });
	dbSpies.updateWhere.mockResolvedValue(undefined);
	dbSpies.insert.mockReturnValue({ values: dbSpies.insertValues });
	dbSpies.insertValues.mockResolvedValue(undefined);
	dbSpies.searchMovies.mockResolvedValue([]);
	dbSpies.generateContent.mockResolvedValue({
		text: JSON.stringify({ response_text: 'Safe response', recommended_movie_titles: [] })
	});
});

afterEach(() => {
	if (ORIGINAL_GEMINI_KEY === undefined) {
		delete process.env.GEMINI_API_KEY;
	} else {
		process.env.GEMINI_API_KEY = ORIGINAL_GEMINI_KEY;
	}
	vi.restoreAllMocks();
});

describe('AI chat privacy boundary', () => {
	it('binds existing-session lookup and update to both user ID and session key', async () => {
		const sessionKey = 'shared-browser-session';
		dbSpies.aiChatFindFirst.mockResolvedValue({ messages: [] });

		const { response } = await callChat({ message: 'Recommend a film' }, sessionKey);

		expect(response.status).toBe(200);
		const lookupPredicate = dbSpies.aiChatFindFirst.mock.calls[0][0].where as SQL;
		const updatePredicate = dbSpies.updateWhere.mock.calls[0][0] as SQL;
		expect(compileSessionPredicate(lookupPredicate).params).toEqual([USER_ID, sessionKey]);
		expect(compileSessionPredicate(updatePredicate).params).toEqual([USER_ID, sessionKey]);
		expect(dbSpies.insert).not.toHaveBeenCalled();
	});

	it('binds reset deletion to the user and creates a replacement owned by that user', async () => {
		const previousSessionKey = 'session-owned-by-another-context';

		const { response, cookies } = await callChat(
			{ message: 'Start over', reset: true },
			previousSessionKey
		);

		expect(response.status).toBe(200);
		const deletePredicate = dbSpies.deleteWhere.mock.calls[0][0] as SQL;
		expect(compileSessionPredicate(deletePredicate).params).toEqual([USER_ID, previousSessionKey]);
		expect(dbSpies.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: USER_ID,
				sessionKey: expect.not.stringMatching(previousSessionKey)
			})
		);
		expect(cookies.set).toHaveBeenCalledWith(
			'ai_chat_session',
			expect.any(String),
			expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
		);
	});

	it('excludes quarantined movies from the taste profile sent to the model', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		dbSpies.interactionFindMany
			.mockResolvedValueOnce([
				{ movie: movieFixture({ title: 'Safe Top Rated', tmdbId: 10 }), rating: '5' },
				{ movie: movieFixture({ title: 'Adult Top Rated', tmdbId: 11, adult: true }), rating: '5' },
				{
					movie: movieFixture({
						title: 'Explicit Top Rated',
						tmdbId: 12,
						keywords: [{ keywordId: 267122 }]
					}),
					rating: '5'
				}
			])
			.mockResolvedValueOnce([
				{ movie: movieFixture({ title: 'Safe Favorite', tmdbId: 13 }) },
				{ movie: movieFixture({ title: 'Custom Favorite', tmdbId: -14 }) }
			]);
		dbSpies.reviewFindMany.mockResolvedValue([
			{ movie: movieFixture({ title: 'Safe Review', tmdbId: 15 }), content: 'Loved it' },
			{
				movie: movieFixture({ title: 'Adult Review', tmdbId: 16, adult: true }),
				content: 'Private'
			}
		]);

		const { response } = await callChat({ message: 'What should I watch?' });

		expect(response.status).toBe(200);
		const generationRequest = dbSpies.generateContent.mock.calls[0][0];
		const modelInput = generationRequest.contents[0].parts[0].text as string;
		expect(modelInput).toContain('Safe Top Rated');
		expect(modelInput).toContain('Safe Favorite');
		expect(modelInput).toContain('Safe Review');
		expect(modelInput).not.toContain('Adult Top Rated');
		expect(modelInput).not.toContain('Explicit Top Rated');
		expect(modelInput).not.toContain('Custom Favorite');
		expect(modelInput).not.toContain('Adult Review');
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(dbSpies.insertValues).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID }));
	});
});
