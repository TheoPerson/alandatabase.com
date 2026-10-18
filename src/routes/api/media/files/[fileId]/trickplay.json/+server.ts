// Owner-only: scrub-preview sprite sheet manifest.
import type { RequestHandler } from './$types';
import { trickplayManifest } from '$lib/server/media/api';

export const GET: RequestHandler = (event) => trickplayManifest(event);
