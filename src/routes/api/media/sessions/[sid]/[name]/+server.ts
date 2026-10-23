// Owner-only: HLS playlists, init segment and media segments of a session.
import type { RequestHandler } from './$types';
import { sessionAsset } from '$lib/server/media/api';

export const GET: RequestHandler = (event) => sessionAsset(event);
