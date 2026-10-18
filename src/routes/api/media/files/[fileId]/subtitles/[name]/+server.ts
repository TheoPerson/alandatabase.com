// Owner-only: a subtitle track as WebVTT (<ordinal>.vtt).
import type { RequestHandler } from './$types';
import { subtitle } from '$lib/server/media/api';

export const GET: RequestHandler = (event) => subtitle(event);
