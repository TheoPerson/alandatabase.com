import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { userMovieInteractions, userReviews } from '$lib/server/db/schema';
import { eq, desc, gte, and } from 'drizzle-orm';
import { searchMovies } from '$lib/server/services/movie.service';
import { GoogleGenAI, Type } from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY;

// In-memory session store: sessionId -> message history
// Survives for the lifetime of the serverless function instance
const chatSessions = new Map<string, Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>>();

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!geminiApiKey || geminiApiKey === 'YOUR_GEMINI_KEY') {
		throw error(500, 'Gemini API Key is not configured.');
	}

	const body = await request.json();
	const userMessage: string = body.message?.trim();
	const resetSession: boolean = body.reset ?? false;

	if (!userMessage) {
		throw error(400, 'No message provided.');
	}

	// Session management
	let sessionId = cookies.get('ai_chat_session');
	if (!sessionId || resetSession) {
		sessionId = crypto.randomUUID();
		cookies.set('ai_chat_session', sessionId, {
			path: '/',
			maxAge: 60 * 60 * 2, // 2h
			httpOnly: true,
			sameSite: 'lax'
		});
	}

	if (resetSession) {
		chatSessions.delete(sessionId);
	}

	// Build or retrieve history
	if (!chatSessions.has(sessionId)) {
		chatSessions.set(sessionId, []);
	}
	const history = chatSessions.get(sessionId)!;

	// First message in session: inject user taste profile as context
	let systemContext = '';
	if (history.length === 0) {
		try {
			const topRated = await db.query.userMovieInteractions.findMany({
				where: and(eq(userMovieInteractions.userId, locals.user.id), gte(userMovieInteractions.rating, 4)),
				with: { movie: true },
				limit: 20
			});
			const topTitles = topRated.map(i => `${i.movie.title} (${i.rating}★)`).join(', ');

			const favorites = await db.query.userMovieInteractions.findMany({
				where: and(eq(userMovieInteractions.userId, locals.user.id), eq(userMovieInteractions.favorite, true)),
				with: { movie: true },
				limit: 10
			});
			const favoriteTitles = favorites.map(i => i.movie.title).join(', ');

			const recentReviews = await db.query.userReviews.findMany({
				where: eq(userReviews.userId, locals.user.id),
				with: { movie: true },
				orderBy: [desc(userReviews.createdAt)],
				limit: 5
			});
			const reviewTexts = recentReviews.map(r => `"${r.movie.title}": ${r.content}`).join(' | ');

			systemContext = `
[USER TASTE PROFILE — use this to personalize all responses in this conversation]
Top-rated films: ${topTitles || 'None yet'}
Favorites: ${favoriteTitles || 'None yet'}
Recent reviews: ${reviewTexts || 'None yet'}
---
`.trim();
		} catch {
			// Non-blocking: profile unavailable
		}
	}

	// Append user message to history
	const fullUserMessage = history.length === 0 && systemContext
		? `${systemContext}\n\nUser request: ${userMessage}`
		: userMessage;

	history.push({ role: 'user', parts: [{ text: fullUserMessage }] });

	// Call Gemini with full chat history (multi-turn)
	const ai = new GoogleGenAI({ apiKey: geminiApiKey });

	const systemInstruction = `You are Alan's personal AI film curator — a sophisticated, opinionated cinephile with deep knowledge of world cinema. You have access to the user's watch history and taste profile.

Your behavior:
- Respond in a conversational, engaging tone. Never bullet-point your response text.
- Remember everything said earlier in this conversation.
- When recommending movies, ALWAYS include exact titles in the JSON field.
- If the user is just chatting (no recommendation needed), return an empty array for recommended_movie_titles.
- You can refine, argue, debate, or expand on previous recommendations.

You MUST always return valid JSON with this exact structure:
{
  "response_text": "Your conversational reply...",
  "recommended_movie_titles": ["Title 1", "Title 2"]
}`;

	const response = await ai.models.generateContent({
		model: 'gemini-2.5-flash',
		contents: history,
		config: {
			systemInstruction,
			responseMimeType: 'application/json',
			responseSchema: {
				type: Type.OBJECT,
				properties: {
					response_text: { type: Type.STRING },
					recommended_movie_titles: {
						type: Type.ARRAY,
						items: { type: Type.STRING }
					}
				},
				required: ['response_text', 'recommended_movie_titles']
			}
		}
	});

	const responseText = response.text;
	if (!responseText) throw error(500, 'Empty response from AI');

	const parsed = JSON.parse(responseText);

	// Append AI response to history
	history.push({ role: 'model', parts: [{ text: responseText }] });
	chatSessions.set(sessionId, history);

	// Resolve movies from DB / TMDB
	const resolvedMovies = [];
	for (const title of (parsed.recommended_movie_titles || [])) {
		const results = await searchMovies(title, 1);
		if (results.length > 0) resolvedMovies.push(results[0]);
	}

	return json({
		reply: parsed.response_text,
		movies: resolvedMovies,
		turnCount: Math.floor(history.length / 2)
	});
};
