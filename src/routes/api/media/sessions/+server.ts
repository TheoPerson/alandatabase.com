// Owner-only: start a playback session (see src/lib/server/media/api.ts).
import type { RequestHandler } from './$types';
import { startSession } from '$lib/server/media/api';

export const POST: RequestHandler = (event) => startSession(event);
