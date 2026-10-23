import { json } from '@sveltejs/kit';
import { notifyMovieStreamed } from '$lib/server/services/telegram.service';

export async function POST({ request, locals }) {
	const body = await request.json().catch(() => null);
	if (!body || typeof body.title !== 'string' || !body.title.trim()) {
		return json({ ok: false }, { status: 400 });
	}

	// Public endpoint: clamp every field before it reaches the Telegram channel
	const title = body.title.slice(0, 200);
	const serverName = typeof body.serverName === 'string' ? body.serverName.slice(0, 80) : undefined;
	const posterPath =
		typeof body.posterPath === 'string' ? body.posterPath.slice(0, 300) : undefined;
	const user = locals.user?.username;

	notifyMovieStreamed(title, serverName, user, posterPath).catch(() => {});

	return json({ ok: true });
}
