import { telemetryBus } from '../telemetry-bus';

export type ChannelCategory = 'major' | 'ingest' | 'users' | 'logs';

interface TelegramSendOptions {
	category?: ChannelCategory;
	photoUrl?: string | null;
	inlineButtons?: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
	disableWebPagePreview?: boolean;
}

const sentDedupeCache = new Map<string, number>();
const DEDUPE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

export async function sendTelegramCard(text: string, options: TelegramSendOptions = {}): Promise<boolean> {
	const botToken = process.env.TELEGRAM_BOT_TOKEN || '8811353440:AAEzLAMSAVKEz6i9mYX6nfV--NrPAnVxGqE';
	let chatId = process.env.TELEGRAM_CHAT_ID || '1147966448';
	let topicId: number | undefined = undefined;

	if (!botToken || !chatId || botToken === 'YOUR_TELEGRAM_BOT_TOKEN') {
		return false;
	}

	// De-duplication check: prevent spamming identical cards within 15 minutes
	const now = Date.now();
	for (const [key, timestamp] of sentDedupeCache.entries()) {
		if (now - timestamp > DEDUPE_TTL_MS) {
			sentDedupeCache.delete(key);
		}
	}

	const dedupeKey = text.slice(0, 100);
	if (sentDedupeCache.has(dedupeKey)) {
		return true; // Already dispatched recently, skip Telegram notification
	}
	sentDedupeCache.set(dedupeKey, now);

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
// 1. 🚨 MAJOR EVENTS & CRITICAL RUNTIME ALERTS
// -------------------------------------------------------------
export async function notifyCriticalError(context: string, error: any) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	const timestamp = new Date().toISOString();
	
	telemetryBus.emit({
		level: 'ERROR',
		source: 'SERVER_EXCEPTION',
		message: `${context} -> ${errorMsg.slice(0, 150)}`,
		metadata: { context, error: errorMsg }
	});

	const text =
		`🔴 <b>[CORE ENGINE] CRITICAL RUNTIME EXCEPTION</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`⚡ <b>Context Scope:</b> <code>${context}</code>\n` +
		`💥 <b>Stack / Trace:</b>\n<code>${errorMsg.slice(0, 350)}</code>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🛠️ <b>Runtime Node:</b> <code>Vercel Serverless (Node.js / ESM)</code>\n` +
		`⏱️ <b>UTC Timestamp:</b> <code>${timestamp}</code>`;

	return sendTelegramCard(text, {
		category: 'major',
		inlineButtons: [[{ text: '🛠️ Sentry Console', url: 'https://alandatabase.sentry.io' }]]
	});
}

export async function notifyMajorEvent(title: string, message: string, severity: 'CRITICAL' | 'WARNING' | 'NOTICE' = 'NOTICE') {
	const icon = severity === 'CRITICAL' ? '🔴' : severity === 'WARNING' ? '🟠' : '🟢';
	const timestamp = new Date().toISOString();

	telemetryBus.emit({
		level: severity === 'CRITICAL' ? 'ERROR' : severity === 'WARNING' ? 'WARN' : 'INFO',
		source: 'CLUSTER_EVENT',
		message: `${title}: ${message}`
	});

	const text =
		`${icon} <b>[SYSTEM TELEMETRY] CLUSTER EVENT • ${severity}</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`📌 <b>Event:</b> <code>${title}</code>\n` +
		`📝 <b>Payload:</b> ${message}\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`⏱️ <b>UTC Timestamp:</b> <code>${timestamp}</code>`;

	return sendTelegramCard(text, { category: 'major' });
}

// -------------------------------------------------------------
// 2. 🎬 INGESTION PIPELINE & METADATA SYNC
// -------------------------------------------------------------
export async function notifyMovieIngested(
	title: string,
	year?: string | number,
	tmdbId?: number | string,
	posterPath?: string | null
) {
	const timestamp = new Date().toISOString();
	const fullPosterUrl = posterPath
		? posterPath.startsWith('http')
			? posterPath
			: `https://image.tmdb.org/t/p/w500${posterPath}`
		: null;

	telemetryBus.emit({
		level: 'INGEST',
		source: 'TMDB_INGEST',
		message: `Movie Ingested: "${title}" (${year || 'N/A'}) [TMDB #${tmdbId || 'N/A'}]`,
		metadata: { title, tmdbId, year }
	});

	const text =
		`🟣 <b>[INGESTION PIPELINE] TMDB ASSET INGEST COMPLETE</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🎬 <b>Entity:</b> <b>${title}</b> ${year ? `(${year})` : ''}\n` +
		`🆔 <b>TMDB UID:</b> <code>#${tmdbId || 'N/A'}</code>\n` +
		`📦 <b>Pipeline Sync:</b> <code>Cast, Crew, Trailers & HD Streams</code>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`⚡ <b>Status:</b> <code>200 OK • Ingested to Database</code>\n` +
		`⏱️ <b>UTC Timestamp:</b> <code>${timestamp}</code>`;

	const buttons: Array<Array<{ text: string; url: string }>> = [
		[
			{ text: '🎬 Watch on CinemaDB', url: `https://alandatabase.com/movies/${tmdbId}` },
			{ text: '🔗 TMDB Reference', url: `https://www.themoviedb.org/movie/${tmdbId}` }
		]
	];

	return sendTelegramCard(text, {
		category: 'ingest',
		photoUrl: fullPosterUrl,
		inlineButtons: buttons
	});
}

// -------------------------------------------------------------
// 3. 👤 AUTH & IDENTITY TELEMETRY
// -------------------------------------------------------------
export async function notifyUserRegistered(username: string, email?: string) {
	const timestamp = new Date().toISOString();

	telemetryBus.emit({
		level: 'SUCCESS',
		source: 'AUTH_RADAR',
		message: `User Registered: @${username} (${email || 'no-email'})`
	});

	const text =
		`👤 <b>[AUTH RADAR] IDENTITY PROVISIONED</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🏷️ <b>Username:</b> <code>${username}</code>\n` +
		`${email ? `📧 <b>Email Identity:</b> <code>${email}</code>\n` : ''}` +
		`🛡️ <b>Auth Protocol:</b> <code>Argon2id Hash + Secure Session Vault</code>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`⚡ <b>Session Status:</b> <code>Active / Authenticated</code>\n` +
		`⏱️ <b>UTC Timestamp:</b> <code>${timestamp}</code>`;

	return sendTelegramCard(text, {
		category: 'users',
		inlineButtons: [[{ text: '📊 User Vault', url: 'https://alandatabase.com/my/films' }]]
	});
}

export async function notifyUserLogin(username: string, ip?: string) {
	const timestamp = new Date().toISOString();

	telemetryBus.emit({
		level: 'INFO',
		source: 'AUTH_RADAR',
		message: `User Session Started: @${username} [${ip || 'unknown-ip'}]`
	});

	const text =
		`🔑 <b>[AUTH RADAR] SESSION ESTABLISHED</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🏷️ <b>Username:</b> <code>${username}</code>\n` +
		`${ip ? `🌐 <b>Client Origin:</b> <code>${ip}</code>\n` : ''}` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`⏱️ <b>UTC Timestamp:</b> <code>${timestamp}</code>`;

	return sendTelegramCard(text, { category: 'users' });
}

// -------------------------------------------------------------
// 4. 📡 LIVE RUNTIME ACTIVITY (DISCOVERY & STREAMING)
// -------------------------------------------------------------
export async function notifyMovieStreamed(movieTitle: string, serverName?: string, user?: string, posterPath?: string | null) {
	const timestamp = new Date().toISOString();
	const fullPosterUrl = posterPath ? (posterPath.startsWith('http') ? posterPath : `https://image.tmdb.org/t/p/w500${posterPath}`) : null;

	telemetryBus.emit({
		level: 'STREAM',
		source: 'STREAM_PIPELINE',
		message: `Stream Playback: "${movieTitle}" via ${serverName || 'Vidzy HD'} by @${user || 'Guest'}`
	});

	const text =
		`🟢 <b>[STREAM PIPELINE] PLAYBACK SESSION INITIALIZED</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🎬 <b>Entity:</b> <b>${movieTitle}</b>\n` +
		`📡 <b>Mirror Gateway:</b> <code>${serverName || 'Vidzy HD (HLS / m3u8)'}</code>\n` +
		`👤 <b>Viewer:</b> <code>${user || 'Anonymous / Guest'}</code>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`⚡ <b>Protocol:</b> <code>Multi-Server Embed Sandbox (1080p Ultra HD)</code>\n` +
		`⏱️ <b>UTC Timestamp:</b> <code>${timestamp}</code>`;

	return sendTelegramCard(text, {
		category: 'logs',
		photoUrl: fullPosterUrl,
		inlineButtons: [[{ text: '▶ Open Stream Player', url: 'https://alandatabase.com/movies' }]]
	});
}

export async function notifySearchPerformed(query: string, resultCount: number) {
	const timestamp = new Date().toISOString();

	telemetryBus.emit({
		level: 'SEARCH',
		source: 'SEARCH_ENGINE',
		message: `Search Query: "${query}" -> ${resultCount} hits resolved`
	});

	const text =
		`🔍 <b>[TELEMETRY] SEARCH QUERY VECTOR DISPATCHED</b>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`🔎 <b>Query String:</b> <code>"${query}"</code>\n` +
		`📊 <b>Relevance Matches:</b> <code>${resultCount} titles resolved</code>\n` +
		`⚡ <b>Engine:</b> <code>Dual-Source Hybrid (PostgreSQL + TMDB v3 API)</code>\n` +
		`━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
		`⏱️ <b>UTC Timestamp:</b> <code>${timestamp}</code>`;

	return sendTelegramCard(text, {
		category: 'logs',
		inlineButtons: [[{ text: '🔍 View Search Vector', url: `https://alandatabase.com/search?q=${encodeURIComponent(query)}` }]]
	});
}
