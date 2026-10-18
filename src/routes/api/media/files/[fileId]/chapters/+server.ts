// Owner-only: chapter markers of a file.
import type { RequestHandler } from './$types';
import { chapters } from '$lib/server/media/api';

export const GET: RequestHandler = (event) => chapters(event);
