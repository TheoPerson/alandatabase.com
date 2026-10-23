// Owner-only: stop a playback session and its ffmpeg process.
import type { RequestHandler } from './$types';
import { stopSession } from '$lib/server/media/api';

export const DELETE: RequestHandler = (event) => stopSession(event);
