import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { aiChatSessions, userMovieInteractions, userReviews } from '$lib/server/db/schema';
import { eq, desc, gte, and } from 'drizzle-orm';
import { searchMovies } from '$lib/server/services/movie.service';
import { isStandardMovie } from '$lib/server/policies/movie-visibility';
import { GoogleGenAI, Type } from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY;

type GeminiMessage = { role: 'user' | 'model'; parts: Array<{ text: string }> };

const MAX_REQUEST_BYTES = 16_384;
const MAX_USER_MESSAGE_LENGTH = 2_000;
const MAX_RECOMMENDATIONS = 8;

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!geminiApiKey || geminiApiKey === 'YOUR_GEMINI_KEY')
		throw error(500, 'Gemini API Key not configured.');

	const rawBody = await request.text();
	if (rawBody.length > MAX_REQUEST_BYTES) throw error(413, 'Request is too large.');

	let body: { message?: unknown; reset?: unknown };
	try {
		body = JSON.parse(rawBody) as { message?: unknown; reset?: unknown };
	} catch {
		throw error(400, 'Invalid JSON body.');
	}

	const userMessage = typeof body.message === 'string' ? body.message.trim() : '';
	const resetSession = body.reset === true;

	if (!userMessage) throw error(400, 'No message provided.');
	if (userMessage.length > MAX_USER_MESSAGE_LENGTH) {
		throw error(400, `Message must be ${MAX_USER_MESSAGE_LENGTH} characters or fewer.`);
	}

	// ── Session management (DB-backed, survives cold starts) ──────────────────
	const previousSessionKey = cookies.get('ai_chat_session');

	// Delete old session row if resetting
	if (resetSession && previousSessionKey) {
		await db
			.delete(aiChatSessions)
			.where(
				and(
					eq(aiChatSessions.userId, locals.user.id),
					eq(aiChatSessions.sessionKey, previousSessionKey)
				)
			);
	}

	let sessionKey = resetSession ? undefined : previousSessionKey;
	if (!sessionKey) {
		sessionKey = crypto.randomUUID();
		cookies.set('ai_chat_session', sessionKey, {
			path: '/',
			maxAge: 60 * 60 * 6,
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production'
		});
	}

	// Load or create session from DB
	const sessionRow = await db.query.aiChatSessions.findFirst({
		where: and(eq(aiChatSessions.userId, locals.user.id), eq(aiChatSessions.sessionKey, sessionKey))
	});

	let history: GeminiMessage[] = (sessionRow?.messages as GeminiMessage[]) ?? [];
	const isNewSession = !sessionRow;

	// ── First message: inject taste profile as context ────────────────────────
	let systemContext = '';
	if (isNewSession) {
		try {
			const [topRated, favorites, recentReviews] = await Promise.all([
				db.query.userMovieInteractions.findMany({
					where: and(
						eq(userMovieInteractions.userId, locals.user.id),
						gte(userMovieInteractions.rating, '4')
					),
					with: { movie: { with: { keywords: true } } },
					limit: 20
				}),
				db.query.userMovieInteractions.findMany({
					where: and(
						eq(userMovieInteractions.userId, locals.user.id),
						eq(userMovieInteractions.favorite, true)
					),
					with: { movie: { with: { keywords: true } } },
					limit: 10
				}),
				db.query.userReviews.findMany({
					where: eq(userReviews.userId, locals.user.id),
					with: { movie: { with: { keywords: true } } },
					orderBy: [desc(userReviews.createdAt)],
					limit: 5
				})
			]);

			const topTitles = topRated
				.filter((item) => isStandardMovie(item.movie))
				.map((item) => `${item.movie?.title} (${item.rating}★)`)
				.join(', ');
			const favTitles = favorites
				.filter((item) => isStandardMovie(item.movie))
				.map((item) => item.movie?.title)
				.join(', ');
			const reviews = recentReviews
				.filter((review) => isStandardMovie(review.movie))
				.map((review) => `"${review.movie?.title}": ${review.content}`)
				.join(' | ');

			systemContext = [
				'[USER TASTE PROFILE — use this throughout the conversation]',
				`Top-rated: ${topTitles || 'None yet'}`,
				`Favorites: ${favTitles || 'None yet'}`,
				`Recent reviews: ${reviews || 'None yet'}`,
				'---'
			].join('\n');
		} catch {
			// Non-blocking
		}
	}

	// ── Append user turn ──────────────────────────────────────────────────────
	const fullUserText =
		isNewSession && systemContext ? `${systemContext}\n\nUser: ${userMessage}` : userMessage;

	history.push({ role: 'user', parts: [{ text: fullUserText }] });

	// ── Call Gemini (multi-turn) ───────────────────────────────────────────────
	const ai = new GoogleGenAI({ apiKey: geminiApiKey });

	const response = await ai.models.generateContent({
		model: 'gemini-2.5-flash',
		contents: history,
		config: {
			systemInstruction: `You are Alan's personal AI film curator — an opinionated cinephile with encyclopedic knowledge of world cinema. You know the user's full taste profile from their database.

Rules:
- Conversational, never use bullet points in response_text. Talk naturally.
- Remember everything from earlier in this chat.
- When recommending, always provide exact, official titles in recommended_movie_titles.
- If the user is chatting without needing recommendations, return an empty array.
- You can debate, refine, or expand on previous suggestions.

Always return valid JSON:
{"response_text": "...", "recommended_movie_titles": ["..."]}`,
			responseMimeType: 'application/json',
			responseSchema: {
				type: Type.OBJECT,
				properties: {
					response_text: { type: Type.STRING },
					recommended_movie_titles: { type: Type.ARRAY, items: { type: Type.STRING } }
				},
				required: ['response_text', 'recommended_movie_titles']
			}
		}
	});

	const rawText = response.text;
	if (!rawText) throw error(500, 'Empty AI response');

	const parsed = JSON.parse(rawText);

	// ── Append model turn & persist to DB ────────────────────────────────────
	history.push({ role: 'model', parts: [{ text: rawText }] });

	// Keep history bounded (last 40 turns = 20 exchanges) to avoid token bloat
	if (history.length > 40) history = history.slice(history.length - 40);

	if (sessionRow) {
		await db
			.update(aiChatSessions)
			.set({ messages: history, updatedAt: new Date() })
			.where(
				and(eq(aiChatSessions.userId, locals.user.id), eq(aiChatSessions.sessionKey, sessionKey))
			);
	} else {
		await db.insert(aiChatSessions).values({
			userId: locals.user.id,
			sessionKey,
			messages: history
		});
	}

	// ── Resolve movie posters from TMDB ───────────────────────────────────────
	const resolvedMovies = [];
	const recommendedTitles = Array.isArray(parsed.recommended_movie_titles)
		? parsed.recommended_movie_titles
				.filter((title: unknown): title is string => typeof title === 'string')
				.slice(0, MAX_RECOMMENDATIONS)
		: [];
	for (const title of recommendedTitles) {
		const results = await searchMovies(title.slice(0, 120), 1);
		if (results.length > 0) resolvedMovies.push(results[0]);
	}

	return json({
		reply: parsed.response_text,
		movies: resolvedMovies,
		turnCount: Math.floor(history.length / 2)
	});
};
