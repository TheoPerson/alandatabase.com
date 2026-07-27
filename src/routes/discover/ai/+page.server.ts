import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { movies, userMovieInteractions, userReviews } from '$lib/server/db/schema';
import { eq, desc, gte, and } from 'drizzle-orm';
import { searchMovies } from '$lib/server/services/movie.service';
import { buildAiPrompt } from '$lib/server/services/ai.service';
import { GoogleGenAI, Type } from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY;

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	if (!geminiApiKey || geminiApiKey === 'YOUR_GEMINI_KEY') {
		return { missingApiKey: true };
	}

	return { missingApiKey: false };
}

export const actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		if (!geminiApiKey || geminiApiKey === 'YOUR_GEMINI_KEY') {
			return fail(500, { error: 'Gemini API Key is not configured.' });
		}

		const formData = await request.formData();
		const userPrompt = formData.get('prompt')?.toString();

		if (!userPrompt || userPrompt.trim() === '') {
			return fail(400, { error: 'Please enter a prompt.' });
		}

		try {
			// 1. Gather User Taste Profile
			// Fetch top rated movies (4 and 5 stars)
			const topRated = await db.query.userMovieInteractions.findMany({
				where: and(eq(userMovieInteractions.userId, locals.user.id), gte(userMovieInteractions.rating, 4)),
				with: { movie: true },
				limit: 20
			});
			const topTitles = topRated.map(i => `${i.movie.title} (${i.rating} stars)`).join(', ');

			// Fetch favorites
			const favorites = await db.query.userMovieInteractions.findMany({
				where: and(eq(userMovieInteractions.userId, locals.user.id), eq(userMovieInteractions.favorite, true)),
				with: { movie: true },
				limit: 10
			});
			const favoriteTitles = favorites.map(i => i.movie.title).join(', ');

			// Fetch recent reviews
			const recentReviews = await db.query.userReviews.findMany({
				where: eq(userReviews.userId, locals.user.id),
				with: { movie: true },
				orderBy: [desc(userReviews.createdAt)],
				limit: 5
			});
			const reviewTexts = recentReviews.map(r => `Movie: ${r.movie.title} | Review: ${r.content}`).join('\n');

			// 2. Build LLM Prompt
			const aiPrompt = buildAiPrompt(userPrompt, { topTitles, favoriteTitles, reviewTexts });

			// 3. Call Gemini API
			const ai = new GoogleGenAI({ apiKey: geminiApiKey });
			const response = await ai.models.generateContent({
				model: 'gemini-2.5-flash',
				contents: aiPrompt,
				config: {
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
			if (!responseText) {
				throw new Error("Empty response from AI");
			}

			const parsed = JSON.parse(responseText);

			// 4. Resolve movies using auto-ingestion pipeline
			const resolvedMovies = [];
			for (const title of parsed.recommended_movie_titles) {
				// Search our service for this exact title. This will hit TMDB and ingest it if missing.
				const results = await searchMovies(title, 1);
				if (results.length > 0) {
					resolvedMovies.push(results[0]);
				}
			}

			return {
				success: true,
				aiResponse: parsed.response_text,
				movies: resolvedMovies
			};

		} catch (err) {
			console.error('AI Integration Error:', err);
			return fail(500, { error: 'The AI failed to generate recommendations. Please try again later.' });
		}
	}
};
