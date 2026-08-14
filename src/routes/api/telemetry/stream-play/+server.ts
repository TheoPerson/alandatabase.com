import { json } from '@sveltejs/kit';
import { notifyMovieStreamed } from '$lib/server/services/telegram.service';

export async function POST({ request, locals }) {
	const body = await request.json().catch(() => null);
	if (!body || !body.title) {
		return json({ ok: false }, { status: 400 });
	}

	const { title, serverName, posterPath } = body;
	const user = locals.user?.username;

	notifyMovieStreamed(title, serverName, user, posterPath).catch(() => {});

	return json({ ok: true });
}
