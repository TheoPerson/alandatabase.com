import 'dotenv/config';

console.clear();
console.log('\x1b[32m%s\x1b[0m', '════════════════════════════════════════════════════════════');
console.log('\x1b[32m%s\x1b[0m', '  ALAN DATABASE / CINEMADB • LIVE TELEMETRY RADAR (2026)');
console.log('\x1b[32m%s\x1b[0m', '════════════════════════════════════════════════════════════');

const localUrl = 'http://localhost:5173/api/telemetry/events';
const prodUrl = 'https://alandatabase.com/api/telemetry/events';

async function startMonitor() {
	let targetUrl = localUrl;
	let label = 'LOCAL (localhost:5173)';

	// First try connecting to local
	try {
		console.log('\x1b[90m%s\x1b[0m', '📡 Probing local dev server (http://localhost:5173)...');
		const localCheck = await fetch(localUrl, { signal: AbortSignal.timeout(1200) }).catch(() => null);
		if (!localCheck || !localCheck.ok) {
			console.log('\x1b[33m%s\x1b[0m', 'ℹ️ Local dev server offline. Switching to LIVE PRODUCTION (alandatabase.com)...');
			targetUrl = prodUrl;
			label = 'LIVE PROD (alandatabase.com)';
		}
	} catch {
		targetUrl = prodUrl;
		label = 'LIVE PROD (alandatabase.com)';
	}

	try {
		console.log(`\x1b[90mConnecting to ${targetUrl}...\x1b[0m`);
		const res = await fetch(targetUrl);
		if (!res.ok || !res.body) {
			console.error(`\x1b[31m[Connection Failed] HTTP ${res.status}\x1b[0m`);
			console.log('\x1b[90mRetrying in 5 seconds...\x1b[0m');
			setTimeout(startMonitor, 5000);
			return;
		}

		console.log('\x1b[32m%s\x1b[0m', `✅ Connected to [${label}]! Listening to real-time events:\n`);

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n\n');
			buffer = lines.pop() || '';

			for (const block of lines) {
				const trimmed = block.trim();
				if (!trimmed || trimmed.startsWith(':')) continue;

				if (trimmed.startsWith('data: ')) {
					try {
						const event = JSON.parse(trimmed.replace('data: ', ''));
						const time = new Date(event.timestamp).toLocaleTimeString();

						let color = '\x1b[36m'; // Cyan
						if (event.level === 'SUCCESS') color = '\x1b[32m'; // Green
						if (event.level === 'STREAM') color = '\x1b[35m'; // Magenta
						if (event.level === 'SEARCH') color = '\x1b[33m'; // Yellow
						if (event.level === 'INGEST') color = '\x1b[95m'; // Pink
						if (event.level === 'ERROR') color = '\x1b[31m'; // Red

						console.log(
							`\x1b[90m[${time}]\x1b[0m ${color}[${event.level}]\x1b[0m \x1b[1m[${event.source}]\x1b[0m ${event.message}`
						);
					} catch (e) {}
				}
			}
		}
	} catch (err) {
		console.error('\x1b[31m%s\x1b[0m', `Connection error: ${(err as Error).message}`);
		console.log('\x1b[90mRetrying in 5 seconds...\x1b[0m');
		setTimeout(startMonitor, 5000);
	}
}

startMonitor();
