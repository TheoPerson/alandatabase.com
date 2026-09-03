import { telemetryBus } from '$lib/server/telemetry-bus';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request }) => {
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			// Send initial history
			const history = telemetryBus.getHistory();
			for (const event of history) {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			}

			// Subscribe to live events
			const unsubscribe = telemetryBus.subscribe((event) => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
				} catch (err) {
					// Client disconnected
					unsubscribe();
				}
			});

			// Heartbeat every 15s to keep connection alive
			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(`: heartbeat\n\n`));
				} catch {
					clearInterval(heartbeat);
					unsubscribe();
				}
			}, 15000);

			request.signal.addEventListener('abort', () => {
				clearInterval(heartbeat);
				unsubscribe();
				try {
					controller.close();
				} catch {
					/* connection already closed */
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		}
	});
};
