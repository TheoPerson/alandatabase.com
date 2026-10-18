// Owner-only: saved playback positions (GET ?fileIds=a,b) and position updates (PUT).
import type { RequestHandler } from './$types';
import { readProgress, writeProgress } from '$lib/server/media/api';

export const GET: RequestHandler = (event) => readProgress(event);
export const PUT: RequestHandler = (event) => writeProgress(event);
