/**
 * Multi-Channel Real-Time Telegram Monitoring Service
 * The Alan's Database / CinemaDB
 * 
 * Supports:
 * 1. 🚨 Major Events / Critical Errors
 * 2. 🎬 Movie Ingestion & Sync
 * 3. 👤 User Accounts (Registration, Deletion, Logins)
 * 4. 📡 Live Activity & Stream Logs
 * 
 * Compatible with Telegram Groups with Topics (message_thread_id) OR separate Channels OR standard DM.
 */

export type ChannelCategory = 'major' | 'ingest' | 'users' | 'logs';

interface TelegramSendOptions {
	category?: ChannelCategory;
	parseMode?: 'HTML' | 'Markdown';
	disableWebPagePreview?: boolean;
}

export async function sendTelegramMessage(text: string, options: TelegramSendOptions = {}): Promise<boolean> {
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
		const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
		const payload: Record<string, any> = {
			chat_id: chatId,
			text,
			parse_mode: options.parseMode || 'HTML',
			disable_web_page_preview: options.disableWebPagePreview ?? true
		};

		if (topicId && !isNaN(topicId)) {
			payload.message_thread_id = topicId;
		}

		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!res.ok) {
			console.warn(`[Telegram ${category.toUpperCase()}] Error ${res.status}:`, await res.text());
			return false;
		}

		return true;
	} catch (err) {
		console.warn(`[Telegram Error] (${category}):`, err);
		return false;
	}
}

// -------------------------------------------------------------
// CHANNEL 1: 🚨 MAJOR EVENTS & CRITICAL SERVER ALERTS
// -------------------------------------------------------------
export async function notifyCriticalError(context: string, error: any) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	const time = new Date().toLocaleTimeString('fr-FR');
	const msg = `🚨 <b>[MAJOR ALERT] Critical Server Exception</b>\n\n` +
		`📍 <b>Context:</b> <code>${context}</code>\n` +
		`💥 <b>Details:</b> <code>${errorMsg.slice(0, 350)}</code>\n` +
		`⏰ <b>Timestamp:</b> ${time}`;

	return sendTelegramMessage(msg, { category: 'major' });
}

export async function notifyMajorEvent(title: string, message: string, severity: 'CRITICAL' | 'WARNING' | 'NOTICE' = 'NOTICE') {
	const icon = severity === 'CRITICAL' ? '🚨' : severity === 'WARNING' ? '⚠️' : '📢';
	const time = new Date().toLocaleTimeString('fr-FR');
	const msg = `${icon} <b>[MAJOR EVENT: ${severity}]</b>\n\n` +
		`📌 <b>${title}</b>\n` +
		`📝 ${message}\n\n` +
		`⏰ <b>Timestamp:</b> ${time}`;

	return sendTelegramMessage(msg, { category: 'major' });
}

// -------------------------------------------------------------
// CHANNEL 2: 🎬 MOVIE INGESTION & DATA SYNC
// -------------------------------------------------------------
export async function notifyMovieIngested(title: string, year?: string | number, tmdbId?: number | string) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const msg = `🎬 <b>[MOVIE INGEST] New Film Added</b>\n\n` +
		`🍿 <b>Title:</b> <b>${title}</b> ${year ? `(${year})` : ''}\n` +
		`🆔 <b>TMDB ID:</b> <code>${tmdbId || 'N/A'}</code>\n` +
		`✨ <b>Pipeline:</b> Ultra HD Streams & Metadata Synced\n` +
		`⏰ <b>Timestamp:</b> ${time}`;

	return sendTelegramMessage(msg, { category: 'ingest' });
}

export async function notifyBulkIngestComplete(count: number, durationSeconds: number) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const msg = `📦 <b>[MOVIE INGEST] Batch Sync Completed</b>\n\n` +
		`🎉 <b>Imported:</b> ${count} movies ingested\n` +
		`⏱️ <b>Duration:</b> ${durationSeconds}s\n` +
		`⏰ <b>Timestamp:</b> ${time}`;

	return sendTelegramMessage(msg, { category: 'ingest' });
}

// -------------------------------------------------------------
// CHANNEL 3: 👤 USER ACCOUNTS & PROFILES
// -------------------------------------------------------------
export async function notifyUserRegistered(username: string, email?: string) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const msg = `👤 <b>[USER ACCOUNT] New Registration</b>\n\n` +
		`🏷️ <b>Username:</b> <code>${username}</code>\n` +
		`${email ? `📧 <b>Email:</b> ${email}\n` : ''}` +
		`🚀 <b>Action:</b> Account created & session activated\n` +
		`⏰ <b>Timestamp:</b> ${time}`;

	return sendTelegramMessage(msg, { category: 'users' });
}

export async function notifyUserLogin(username: string, ip?: string) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const msg = `🔑 <b>[USER ACCOUNT] User Logged In</b>\n\n` +
		`🏷️ <b>Username:</b> <code>${username}</code>\n` +
		`${ip ? `🌐 <b>IP / Origin:</b> <code>${ip}</code>\n` : ''}` +
		`⏰ <b>Timestamp:</b> ${time}`;

	return sendTelegramMessage(msg, { category: 'users' });
}

export async function notifyUserDeleted(username: string) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const msg = `🗑️ <b>[USER ACCOUNT] Account Deleted</b>\n\n` +
		`🏷️ <b>Username:</b> <code>${username}</code>\n` +
		`⏰ <b>Timestamp:</b> ${time}`;

	return sendTelegramMessage(msg, { category: 'users' });
}

// -------------------------------------------------------------
// CHANNEL 4: 📡 LIVE ACTIVITY & RUNTIME LOGS (VIVANT / EN DIRECT)
// -------------------------------------------------------------
export async function notifyMovieStreamed(movieTitle: string, serverName?: string, user?: string) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const msg = `📺 <b>[LIVE STREAM] Movie Playback Started</b>\n\n` +
		`🎥 <b>Film:</b> <b>${movieTitle}</b>\n` +
		`📡 <b>Server Mirror:</b> ${serverName || 'Vidzy HD'}\n` +
		`👤 <b>Viewer:</b> ${user || 'Guest User'}\n` +
		`⏰ <b>Timestamp:</b> ${time}`;

	return sendTelegramMessage(msg, { category: 'logs' });
}

export async function notifySearchPerformed(query: string, resultCount: number) {
	const time = new Date().toLocaleTimeString('fr-FR');
	const msg = `🔍 <b>[LIVE SEARCH] User Search</b>\n\n` +
		`🔎 <b>Query:</b> "<code>${query}</code>"\n` +
		`📊 <b>Found:</b> ${resultCount} matching titles\n` +
		`⏰ <b>Timestamp:</b> ${time}`;

	return sendTelegramMessage(msg, { category: 'logs' });
}
