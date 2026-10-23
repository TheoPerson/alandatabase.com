// Owner-only: unfinished films and episodes for the Continue watching rail.
import type { RequestHandler } from './$types';
import { continueWatching } from '$lib/server/media/api';

export const GET: RequestHandler = (event) => continueWatching(event);
