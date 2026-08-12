export function buildAiPrompt(
	userPrompt: string,
	context: { topTitles: string; favoriteTitles: string; reviewTexts: string }
) {
	return `
You are an expert, highly articulate film curator.
The user is asking for a movie recommendation based on this prompt: "${userPrompt}"

Here is the user's cinematic taste profile based on their database:
Top Rated Films: ${context.topTitles || 'None'}
Favorite Films: ${context.favoriteTitles || 'None'}
Recent Reviews:
${context.reviewTexts || 'None'}

Provide a highly personalized response.
You must return a strict JSON object with EXACTLY this structure:
{
  "response_text": "A friendly, conversational explanation (1-2 paragraphs) of why you are recommending these specific films based on their taste and prompt. Do NOT list the movies using bullet points in this text, just talk to them.",
  "recommended_movie_titles": ["Exact Movie Title 1", "Exact Movie Title 2", "Exact Movie Title 3"]
}
Recommend exactly 3 to 5 movies. Use exact official movie titles (e.g. "The Dark Knight", "Inception").
`;
}
