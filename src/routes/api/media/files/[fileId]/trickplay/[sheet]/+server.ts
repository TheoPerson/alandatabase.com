// Owner-only: one scrub-preview sprite sheet (<n>.webp).
import type { RequestHandler } from './$types';
import { trickplaySheet } from '$lib/server/media/api';

export const GET: RequestHandler = (event) => trickplaySheet(event);
