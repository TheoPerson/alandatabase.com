import { json } from '@sveltejs/kit';
import { searchMovies } from '$lib/server/services/movie.service';
import type { RequestHandler } from './$types';

const MAX_WEBHOOK_BYTES = 32_768;
const MAX_QUERY_LENGTH = 120;

type TelegramMessage = {
	chat?: { id?: string | number };
	text?: string;
};

type TelegramUpdate = {
	message?: TelegramMessage;
};

type TelegramButton = {
	text: string;
	url: string;
};

function escapeTelegramHtml(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export const POST: RequestHandler = async ({ request }) => {
	const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
	const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
	const allowedChatIds = new Set(
		(process.env.TELEGRAM_ALLOWED_CHAT_IDS || '')
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean)
	);

	if (!secretToken || !botToken || allowedChatIds.size === 0) {
		return json({ error: 'Telegram integration is not configured' }, { status: 503 });
	}

	const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token');
	if (incomingSecret !== secretToken) {
		return json({ error: 'Unauthorized webhook request' }, { status: 401 });
	}

	const declaredLength = Number(request.headers.get('content-length') || 0);
	if (declaredLength > MAX_WEBHOOK_BYTES) {
		return json({ error: 'Webhook request is too large' }, { status: 413 });
	}

	const rawBody = await request.text();
	if (rawBody.length > MAX_WEBHOOK_BYTES) {
		return json({ error: 'Webhook request is too large' }, { status: 413 });
	}

	let body: TelegramUpdate;
	try {
		body = JSON.parse(rawBody) as TelegramUpdate;
	} catch {
		return json({ error: 'Invalid webhook payload' }, { status: 400 });
	}

	if (!body.message) {
		return json({ ok: true });
	}

	const message = body.message;
	const chatId = message.chat?.id;
	const text = message.text?.trim() || '';

	if (!chatId || !text) {
		return json({ ok: true });
	}

	if (!allowedChatIds.has(String(chatId))) {
		return json({ error: 'Webhook chat is not allowed' }, { status: 403 });
	}

	if (text.length > MAX_QUERY_LENGTH) {
		return json({ error: 'Webhook message is too long' }, { status: 400 });
	}

	const sendReply = async (
		replyText: string,
		options: { photoUrl?: string | null; buttons?: TelegramButton[][] } = {}
	) => {
		const isPhoto = Boolean(options.photoUrl);
		const endpoint = isPhoto ? 'sendPhoto' : 'sendMessage';
		const payload: Record<string, unknown> = {
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
			`🍿 <b>CinemaDB Catalog Assistant</b>\n` +
			`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
			`Search the approved catalog without changing it:\n\n` +
			`• <code>/search &lt;movie title&gt;</code> - Find a title\n` +
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
	if (query.startsWith('/search ')) query = query.replace('/search ', '').trim();
	else if (query.startsWith('/ingest ') || query.startsWith('/watch ')) {
		return json({ error: 'Catalog mutation and playback commands are disabled' }, { status: 400 });
	}

	if (!query) {
		return json({ error: 'A movie title is required' }, { status: 400 });
	}

	// Search only the approved local catalog. Bot searches never ingest or call TMDB.
	try {
		const [topMovie] = await searchMovies(query, 1);

		if (!topMovie) {
			await sendReply(
				`🔍 <b>No matching film found for:</b> "<code>${escapeTelegramHtml(query)}</code>"\n\n` +
					`Try checking spelling or type another movie title.`
			);
			return json({ ok: true });
		}

		const posterUrl = topMovie.posterPath?.startsWith('/')
			? `https://image.tmdb.org/t/p/w500${topMovie.posterPath}`
			: null;

		const releaseYear = topMovie.releaseDate ? String(topMovie.releaseDate).substring(0, 4) : 'N/A';
		const rating = topMovie.voteAverage ? Number(topMovie.voteAverage).toFixed(1) : 'N/A';

		const replyCard =
			`🎬 <b>CATALOG RESULT</b>\n` +
			`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
			`🍿 <b>${escapeTelegramHtml(topMovie.title)}</b> (${releaseYear})\n` +
			`⭐ <b>TMDB:</b> <code>★ ${rating}/10</code>\n` +
			`📝 <i>${escapeTelegramHtml((topMovie.overview || 'No overview available.').slice(0, 220))}</i>`;

		const buttons = [
			[
				{ text: 'View in CinemaDB', url: `https://alandatabase.com/movies/${topMovie.id}` },
				{
					text: '🔗 TMDB Details',
					url: `https://www.themoviedb.org/movie/${topMovie.tmdbId}`
				}
			]
		];

		await sendReply(replyCard, { photoUrl: posterUrl, buttons });
	} catch {
		await sendReply('⚠️ <b>The catalog search is temporarily unavailable.</b>');
	}

	return json({ ok: true });
};
