import { json, error } from '@sveltejs/kit';
import { getPickerRecommendation } from '$lib/server/picker';
import { parseRecommendRequest, type RecommendRequest } from '$lib/server/picker/request';
import type { ParseResult } from '$lib/server/security/request-bounds';
import type { RequestHandler } from './$types';

async function recommend(userId: string | null, parsed: ParseResult<RecommendRequest>) {
	if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });

	const result = await getPickerRecommendation({ userId, ...parsed.value });
	if (!result) {
		return json(
			{
				movie: null,
				reason: 'No movie candidates match your current filter criteria.',
				sessionId: parsed.value.sessionId
			},
			{ status: 200 }
		);
	}

	return json(result);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	try {
		return await recommend(locals.user?.id ?? null, parseRecommendRequest(body));
	} catch (err) {
		console.error('Error in /api/picker/recommend:', err);
		throw error(500, { message: 'Internal server error while generating movie recommendation.' });
	}
};

export const GET: RequestHandler = async ({ url, locals }) => {
	const parsed = parseRecommendRequest({
		sessionId: url.searchParams.get('sessionId') ?? undefined,
		filters: url.searchParams.has('preset') ? { preset: url.searchParams.get('preset') } : undefined
	});

	try {
		return await recommend(locals.user?.id ?? null, parsed);
	} catch (err) {
		console.error('Error in GET /api/picker/recommend:', err);
		throw error(500, { message: 'Internal server error' });
	}
};
