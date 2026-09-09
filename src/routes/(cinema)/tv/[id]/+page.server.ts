import { getTVShowDetails } from '$lib/server/services/tv.service';
import {
	disableTVEpisodeSubscription,
	getTVEpisodeSubscription,
	saveTVEpisodeSubscription
} from '$lib/server/services/tv-notification.service';
import {
	DEFAULT_NOTIFICATION_TIMEZONE,
	normalizeNotificationOffset,
	normalizeNotificationTimezone
} from '$lib/tv-notifications';
import { error, fail } from '@sveltejs/kit';
import { logServerError } from '$lib/server/security/logging';
import { hasPermission } from '$lib/server/auth/permissions';

export async function load({ params, locals }) {
	const tmdbId = parseInt(params.id, 10);
	if (isNaN(tmdbId)) {
		throw error(404, { message: 'Invalid TV show ID' });
	}

	try {
		const show = await getTVShowDetails(tmdbId);
		if (!show || !show.name) {
			throw error(404, { message: 'TV Show not found' });
		}

		const canManageNotifications = Boolean(
			locals.user && hasPermission(locals.user, 'account:access')
		);
		let episodeSubscription = null;
		if (canManageNotifications && locals.user) {
			try {
				episodeSubscription = await getTVEpisodeSubscription(locals.user.id, tmdbId);
			} catch (subscriptionError) {
				logServerError('TV episode subscription load failed', subscriptionError);
			}
		}
		return {
			show,
			episodeSubscription,
			signedIn: Boolean(locals.user),
			canManageNotifications
		};
	} catch {
		throw error(404, { message: 'TV Show not found in archive' });
	}
}

export const actions = {
	subscribeEpisodes: async ({ params, locals, request }) => {
		if (!locals.user) return fail(401, { error: 'Sign in to monitor new episodes.' });
		if (!hasPermission(locals.user, 'account:access'))
			return fail(403, { error: 'Episode notifications are available to the owner account.' });
		const tmdbId = Number(params.id);
		const show = await getTVShowDetails(tmdbId);
		if (!show) return fail(404, { error: 'TV show not found in the safe catalogue.' });
		const data = await request.formData();
		const settings = (locals.user.settings ?? {}) as Record<string, unknown>;
		try {
			await saveTVEpisodeSubscription({
				userId: locals.user.id,
				tmdbShowId: tmdbId,
				showTitle: show.name,
				posterPath: show.poster_path,
				offsetDays: normalizeNotificationOffset(data.get('offsetDays')),
				timezone: normalizeNotificationTimezone(
					data.get('timezone') ?? settings.calendarTimezone ?? DEFAULT_NOTIFICATION_TIMEZONE
				)
			});
			return { success: true, message: `${show.name} episode alerts are active.` };
		} catch (actionError) {
			logServerError('TV episode subscription save failed', actionError);
			return fail(500, { error: 'Episode alerts could not be saved.' });
		}
	},
	unsubscribeEpisodes: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { error: 'Sign in to change episode alerts.' });
		if (!hasPermission(locals.user, 'account:access'))
			return fail(403, { error: 'Episode notifications are available to the owner account.' });
		const tmdbId = Number(params.id);
		try {
			const disabled = await disableTVEpisodeSubscription(locals.user.id, tmdbId);
			return disabled
				? { success: true, message: 'Episode alerts paused.' }
				: fail(404, { error: 'No episode alert was found.' });
		} catch (actionError) {
			logServerError('TV episode subscription removal failed', actionError);
			return fail(500, { error: 'Episode alerts could not be paused.' });
		}
	}
};
