import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () =>
	json(
		{ error: 'Playback telemetry is disabled until an approved source pipeline exists.' },
		{ status: 410 }
	);
