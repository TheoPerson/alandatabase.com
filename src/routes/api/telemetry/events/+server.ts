import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	return new Response(
		JSON.stringify({
			error: 'Telemetry event streaming is disabled until owner-only redaction is implemented.'
		}),
		{
			status: 410,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'private, no-store'
			}
		}
	);
};
