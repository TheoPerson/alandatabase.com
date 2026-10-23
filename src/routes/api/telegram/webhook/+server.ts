import { json } from '@sveltejs/kit';
import { TMDBClient } from '$lib/server/tmdb';
import { ingestMovie } from '$lib/server/tmdb';

const escapeHtml = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function POST({ request }) {
	// Fail closed: without a configured secret anyone could drive the bot and trigger ingestion
	const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
	const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token');
	if (!secretToken || incomingSecret !== secretToken) {
		return json({ error: 'Unauthorized webhook request' }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	if (!body || !body.message) {
		return json({ ok: true });
	}

	const message = body.message;
	const chatId = message.chat?.id;
	const text = message.text?.trim() || '';

	if (!chatId || !text) {
		return json({ ok: true });
	}

	const botToken = process.env.TELEGRAM_BOT_TOKEN;
	if (!botToken) {
		return json({ ok: true });
	}
	const sendReply = async (
		replyText: string,
		options: { photoUrl?: string | null; buttons?: any[] } = {}
	) => {
		const isPhoto = Boolean(options.photoUrl);
		const endpoint = isPhoto ? 'sendPhoto' : 'sendMessage';
		const payload: Record<string, any> = {
			chat_id: chatId,
			parse_mode: 'HTML'
		};
		if (isPhoto) {
			payload.photo = options.photoUrl;
			payload.caption = replyText;
		} else {
			payload.text = replyText;
		}
		if (options.buttons) {
			payload.reply_markup = { inline_keyboard: options.buttons };
		}
		await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		}).catch(() => {});
	};

	// 1. Command: /start or /help
	if (text.startsWith('/start') || text.startsWith('/help')) {
		const helpText =
			`🍿 <b>CinemaDB On-Demand Assistant</b>\n` +
			`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
			`Type any movie title or command to ingest and stream films instantly:\n\n` +
			`• <code>/ingest &lt;movie title&gt;</code> - Add any film to your vault\n` +
			`• <code>/watch &lt;movie title&gt;</code> - Get instant HD stream\n` +
			`• Or simply type: <b>Inception</b>, <b>Interstellar</b>, etc.\n\n` +
			`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
			`🚀 <i>Directly connected to Alan's Database</i>`;

		await sendReply(helpText, {
			buttons: [[{ text: '🎬 Open CinemaDB', url: 'https://alandatabase.com/movies' }]]
		});
		return json({ ok: true });
	}

	// 2. Extract Movie Query
	let query = text;
	if (query.startsWith('/ingest ')) query = query.replace('/ingest ', '').trim();
	else if (query.startsWith('/watch ')) query = query.replace('/watch ', '').trim();
	else if (query.startsWith('/search ')) query = query.replace('/search ', '').trim();

	// Search TMDB
	try {
		const client = new TMDBClient();
		const searchRes = await client.searchMovies(query, 1);
		const topMovie = searchRes.results?.[0];

		if (!topMovie) {
			await sendReply(
				`🔍 <b>No matching film found for:</b> "<code>${escapeHtml(query)}</code>"\n\n` +
					`Try checking spelling or type another movie title.`
			);
			return json({ ok: true });
		}

		// Auto-ingest into DB in background
		ingestMovie(topMovie.id).catch(() => null);

		const posterUrl = topMovie.poster_path
			? `https://image.tmdb.org/t/p/w500${topMovie.poster_path}`
			: null;

		const releaseYear = topMovie.release_date ? topMovie.release_date.substring(0, 4) : 'N/A';
		const rating = topMovie.vote_average ? topMovie.vote_average.toFixed(1) : 'N/A';

		const replyCard =
			`🎬 <b>MOVIE READY TO STREAM!</b>\n` +
			`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
			`🍿 <b>${escapeHtml(topMovie.title)}</b> (${releaseYear})\n` +
			`⭐ <b>IMDb / TMDB:</b> <code>★ ${rating}/10</code>\n` +
			`📝 <i>${escapeHtml((topMovie.overview || 'No overview available.').slice(0, 220))}...</i>\n` +
			`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
			`⚡ <b>Status:</b> Ingested & Stream Ready (Vidzy HD / 1080p)`;

		const buttons = [
			[
				{ text: '▶️ Watch Now (Vidzy HD)', url: `https://alandatabase.com/movies/${topMovie.id}` },
				{ text: '🔗 TMDB Details', url: `https://www.themoviedb.org/movie/${topMovie.id}` }
			]
		];

		await sendReply(replyCard, { photoUrl: posterUrl, buttons });
	} catch (err) {
		console.error('Telegram webhook error:', err);
		await sendReply(`⚠️ <b>Error processing movie request.</b> Please try again later.`);
	}

	return json({ ok: true });
}
