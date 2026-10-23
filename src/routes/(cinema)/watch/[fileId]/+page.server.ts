import { error, redirect } from '@sveltejs/kit';
import { isOwnerUser } from '$lib/server/auth/owner';
import { buildLaunchPayload, parseStartAt } from '$lib/server/hqp/launch';
import { mintGrant } from '$lib/server/media/grant';
import { appMediaRemote } from '$lib/server/media/remote';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// Alan's HQP: the owner's own files only. Read-only (no session, no ffmpeg), so a hover preload
// has no side effect; the player starts the stream once it is on screen.
export const load = (async ({ params, locals, url, setHeaders }) => {
	if (!locals.user) {
		throw redirect(302, `/auth/login?returnTo=${encodeURIComponent(`/watch/${params.fileId}`)}`);
	}
	// Fail closed and say nothing about whether the file exists.
	if (!isOwnerUser(locals.user)) throw error(404, 'Not found');
	if (!UUID.test(params.fileId)) throw error(404, 'Not found');

	const launch = await buildLaunchPayload(locals.user.id, params.fileId.toLowerCase());
	if (!launch) throw error(404, 'Not found');

	// Online site: stream from the owner's PC (media node) with a short-lived grant.
	const remote = appMediaRemote();
	if (remote) {
		launch.media = {
			origin: remote.origin,
			token: mintGrant(locals.user.id, remote.key, Date.now())
		};
	}

	setHeaders({ 'cache-control': 'private, no-store' });
	return { launch, startAt: parseStartAt(url.searchParams.get('t')) };
}) satisfies PageServerLoad;
