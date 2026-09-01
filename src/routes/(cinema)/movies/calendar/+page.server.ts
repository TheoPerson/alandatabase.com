import { fail, redirect } from '@sveltejs/kit';
import { isOwnerUser } from '$lib/server/auth/owner';
import { logServerError } from '$lib/server/security/logging';
import {
	calendarDefaults,
	createReleaseReminder,
	deleteReleaseReminder,
	parseCalendarQuery,
	readReleaseCalendar,
	saveCalendarPreferences
} from '$lib/server/services/release-calendar.service';
import { REMINDER_OFFSETS, type ReminderOffset } from '$lib/release-calendar';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function load({ locals, url }) {
	if (!locals.user)
		throw redirect(302, `/auth/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`);
	const settings = (locals.user.settings ?? {}) as Record<string, unknown>;
	const query = parseCalendarQuery(url, settings);
	const preferences = calendarDefaults(settings);
	try {
		return {
			...(await readReleaseCalendar(locals.user.id, query)),
			query,
			preferences,
			isOwner: isOwnerUser(locals.user)
		};
	} catch (error) {
		logServerError('Release calendar load failed', error);
		return {
			items: [],
			genres: [],
			latestSync: null,
			stale: false,
			query,
			preferences,
			isOwner: isOwnerUser(locals.user),
			error: 'The release calendar is temporarily unavailable.'
		};
	}
}

export const actions = {
	createReminder: async ({ locals, request }) => {
		if (!locals.user) return fail(401, { error: 'Sign in to create reminders.' });
		const data = await request.formData();
		const eventId = data.get('eventId')?.toString() ?? '';
		const offset = Number(data.get('offsetDays'));
		if (!UUID_PATTERN.test(eventId) || !REMINDER_OFFSETS.includes(offset as ReminderOffset)) {
			return fail(400, { error: 'Reminder details are invalid.' });
		}
		try {
			const reminder = await createReleaseReminder(
				locals.user.id,
				eventId,
				offset as ReminderOffset,
				calendarDefaults((locals.user.settings ?? {}) as Record<string, unknown>).timezone
			);
			return { success: true, message: 'Release reminder saved.', reminderId: reminder?.id };
		} catch (error) {
			if (error instanceof RangeError) return fail(400, { error: error.message });
			logServerError('Release reminder creation failed', error);
			return fail(500, { error: 'The reminder could not be saved.' });
		}
	},
	deleteReminder: async ({ locals, request }) => {
		if (!locals.user) return fail(401, { error: 'Sign in to remove reminders.' });
		const reminderId = (await request.formData()).get('reminderId')?.toString() ?? '';
		if (!UUID_PATTERN.test(reminderId))
			return fail(400, { error: 'Reminder identifier is invalid.' });
		try {
			const removed = await deleteReleaseReminder(locals.user.id, reminderId);
			return removed
				? { success: true, message: 'Release reminder removed.' }
				: fail(404, { error: 'Reminder not found.' });
		} catch (error) {
			logServerError('Release reminder deletion failed', error);
			return fail(500, { error: 'The reminder could not be removed.' });
		}
	},
	savePreferences: async ({ locals, request }) => {
		if (!locals.user) return fail(401, { error: 'Sign in to update calendar preferences.' });
		const data = await request.formData();
		try {
			const settings = await saveCalendarPreferences(
				locals.user.id,
				(locals.user.settings ?? {}) as Record<string, unknown>,
				{ countryCode: data.get('countryCode'), timezone: data.get('timezone') }
			);
			return { success: true, message: 'Calendar preferences saved.', settings };
		} catch (error) {
			logServerError('Calendar preference update failed', error);
			return fail(500, { error: 'Calendar preferences could not be saved.' });
		}
	}
};
