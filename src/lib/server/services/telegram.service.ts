/**
 * Ultra-Luxury Multi-Channel Telegram Monitoring System
 * The Alan's Database / CinemaDB Real-Time Radar
 */

export type ChannelCategory = 'major' | 'ingest' | 'users' | 'logs';

interface TelegramSendOptions {
	category?: ChannelCategory;
	photoUrl?: string | null;
	inlineButtons?: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
	disableWebPagePreview?: boolean;
}

export async function sendTelegramCard(text: string, options: TelegramSendOptions = {}): Promise<boolean> {
	const botToken = process.env.TELEGRAM_BOT_TOKEN;
	let chatId = process.env.TELEGRAM_CHAT_ID;
	let topicId: number | undefined = undefined;

	if (!botToken || !chatId || botToken === 'YOUR_TELEGRAM_BOT_TOKEN') {
		return false;
	}

	// Topic / Sub-channel routing
	const category = options.category || 'logs';
	if (category === 'major') {
		chatId = process.env.TELEGRAM_CHAT_MAJOR || chatId;
		if (process.env.TELEGRAM_TOPIC_MAJOR) topicId = parseInt(process.env.TELEGRAM_TOPIC_MAJOR, 10);
	} else if (category === 'ingest') {
		chatId = process.env.TELEGRAM_CHAT_INGEST || chatId;
		if (process.env.TELEGRAM_TOPIC_INGEST) topicId = parseInt(process.env.TELEGRAM_TOPIC_INGEST, 10);
	} else if (category === 'users') {
		chatId = process.env.TELEGRAM_CHAT_USERS || chatId;
		if (process.env.TELEGRAM_TOPIC_USERS) topicId = parseInt(process.env.TELEGRAM_TOPIC_USERS, 10);
	} else if (category === 'logs') {
		chatId = process.env.TELEGRAM_CHAT_LOGS || chatId;
		if (process.env.TELEGRAM_TOPIC_LOGS) topicId = parseInt(process.env.TELEGRAM_TOPIC_LOGS, 10);
	}

	try {
		const isPhoto = Boolean(options.photoUrl && options.photoUrl.startsWith('http'));
		const endpoint = isPhoto ? 'sendPhoto' : 'sendMessage';
		const url = `https://api.telegram.org/bot${botToken}/${endpoint}`;

		const payload: Record<string, any> = {
			chat_id: chatId,
			parse_mode: 'HTML'
		};

		if (isPhoto) {
			payload.photo = options.photoUrl;
			payload.caption = text;
		} else {
			payload.text = text;
			payload.disable_web_page_preview = options.disableWebPagePreview ?? true;
		}

		if (topicId && !isNaN(topicId)) {
			payload.message_thread_id = topicId;
		}

		if (options.inlineButtons && options.inlineButtons.length > 0) {
			payload.reply_markup = {
				inline_keyboard: options.inlineButtons
			};
		}

		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!res.ok) {
			console.warn(`[Telegram ${category.toUpperCase()}] API Error ${res.status}:`, await res.text());
			return false;
		}

		return true;
	} catch (err) {
		console.warn(`[Telegram Exception] (${category}):`, err);
		return false;
	}
}

// -------------------------------------------------------------
// CHANNEL 1: 🚨 MAJOR EVENTS & CRITICAL ALERTS
// -------------------------------------------------------------
export async function notifyCriticalError(context: string, error: any) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	const time = new Date().toLocaleTimeString('fr-FR');
	const text =
		`🔴 <b>ALAN MONITORING • CRITICAL ALERT</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`📍 <b>Location:</b> <code>${context}</code>\n` +
		`💥 <b>Exception:</b>\n<code>${errorMsg.slice(0, 320)}</code>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`⚡ <b>Status:</b> Immediate Attention Required\n` +
		`🕒 <b>Timestamp:</b> <code>${time}</code>`;

	return sendTelegramCard(text, {
		category: 'major',
		inlineButtons: [[{ text: '🛠️ Open Sentry Console', url: 'https://alandatabase.sentry.io' }]]
	});
}

export async function notifyMajorEvent(title: string, message: string, severity: 'CRITICAL' | 'WARNING' | 'NOTICE' = 'NOTICE') {
	const icon = severity === 'CRITICAL' ? '🔴' : severity === 'WARNING' ? '🟠' : '🟢';
	const time = new Date().toLocaleTimeString('fr-FR');
	const text =
		`${icon} <b>ALAN MONITORING • SYSTEM EVENT</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`📌 <b>${title}</b>\n` +
		`📝 ${message}\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`⚡ <b>Severity:</b> <code>${severity}</code>\n` +
		`🕒 <b>Timestamp:</b> <code>${time}</code>`;

	return sendTelegramCard(text, { category: 'major' });
}

// -------------------------------------------------------------
// CHANNEL 2: 🎬 MOVIE INGESTION (With High-Res Posters & Buttons)
// -------------------------------------------------------------
export async function notifyMovieIngested(
	title: string,
	year?: string | number,
	tmdbId?: number | string,
	posterPath?: string | null
) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const fullPosterUrl = posterPath
		? posterPath.startsWith('http')
			? posterPath
			: `https://image.tmdb.org/t/p/w500${posterPath}`
		: null;

	const text =
		`🟣 <b>CINEMADB • NEW FILM INGESTED</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🍿 <b>Title:</b> <b>${title}</b> ${year ? `(${year})` : ''}\n` +
		`🆔 <b>TMDB:</b> <code>#${tmdbId || 'N/A'}</code>\n` +
		`✨ <b>Pipeline:</b> Ultra HD Streams & Metadata Synced\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🕒 <b>Timestamp:</b> <code>${time}</code>`;

	const buttons: Array<Array<{ text: string; url: string }>> = [
		[
			{ text: '🎬 Watch on Alan\'s DB', url: `https://alandatabase.com/movies/${tmdbId}` },
			{ text: '🔗 TMDB Page', url: `https://www.themoviedb.org/movie/${tmdbId}` }
		]
	];

	return sendTelegramCard(text, {
		category: 'ingest',
		photoUrl: fullPosterUrl,
		inlineButtons: buttons
	});
}

// -------------------------------------------------------------
// CHANNEL 3: 👤 USER ACCOUNTS & SECURITY
// -------------------------------------------------------------
export async function notifyUserRegistered(username: string, email?: string) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const text =
		`👤 <b>AUTH RADAR • NEW USER ONBOARDED</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🏷️ <b>Username:</b> <code>${username}</code>\n` +
		`${email ? `📧 <b>Email:</b> <code>${email}</code>\n` : ''}` +
		`🚀 <b>Action:</b> Account Created & Vault Initialized\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🕒 <b>Timestamp:</b> <code>${time}</code>`;

	return sendTelegramCard(text, {
		category: 'users',
		inlineButtons: [[{ text: '📊 View in Dashboard', url: 'https://alandatabase.com/my/films' }]]
	});
}

export async function notifyUserLogin(username: string, ip?: string) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const text =
		`🔑 <b>AUTH RADAR • USER SESSION START</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🏷️ <b>Username:</b> <code>${username}</code>\n` +
		`${ip ? `🌐 <b>Origin:</b> <code>${ip}</code>\n` : ''}` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🕒 <b>Timestamp:</b> <code>${time}</code>`;

	return sendTelegramCard(text, { category: 'users' });
}

export async function notifyUserDeleted(username: string) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const text =
		`🗑️ <b>AUTH RADAR • ACCOUNT REMOVAL</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🏷️ <b>Username:</b> <code>${username}</code>\n` +
		`⚠️ <b>Action:</b> All session data wiped\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🕒 <b>Timestamp:</b> <code>${time}</code>`;

	return sendTelegramCard(text, { category: 'users' });
}

// -------------------------------------------------------------
// CHANNEL 4: 📡 LIVE RUNTIME ACTIVITY (VIVANT / EN DIRECT)
// -------------------------------------------------------------
export async function notifyMovieStreamed(movieTitle: string, serverName?: string, user?: string, posterPath?: string | null) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const fullPosterUrl = posterPath ? (posterPath.startsWith('http') ? posterPath : `https://image.tmdb.org/t/p/w500${posterPath}`) : null;

	const text =
		`🟢 <b>LIVE STREAM • PLAYBACK STARTED</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🎥 <b>Film:</b> <b>${movieTitle}</b>\n` +
		`📡 <b>Active Server:</b> <code>${serverName || 'Vidzy HD (VFQ)'}</code>\n` +
		`👤 <b>Viewer:</b> <code>${user || 'Guest User'}</code>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🕒 <b>Timestamp:</b> <code>${time}</code>`;

	return sendTelegramCard(text, {
		category: 'logs',
		photoUrl: fullPosterUrl,
		inlineButtons: [[{ text: '▶ Open Stream Player', url: 'https://alandatabase.com/movies' }]]
	});
}

export async function notifySearchPerformed(query: string, resultCount: number) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const text =
		`🔍 <b>LIVE SEARCH • REAL-TIME RADAR</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🔎 <b>Query:</b> "<code>${query}</code>"\n` +
		`📊 <b>Relevance Matches:</b> <b>${resultCount}</b> titles found\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🕒 <b>Timestamp:</b> <code>${time}</code>`;

	return sendTelegramCard(text, {
		category: 'logs',
		inlineButtons: [[{ text: '🔍 View Search Results', url: `https://alandatabase.com/search?q=${encodeURIComponent(query)}` }]]
	});
}
