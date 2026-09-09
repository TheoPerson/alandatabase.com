import { createHash } from 'node:crypto';
import webPush from 'web-push';
import { and, asc, desc, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	notificationEvents,
	pushSubscriptions,
	pushNotificationDeliveries,
	users,
	tvEpisodeEvents,
	tvEpisodeSubscriptions,
	tvEpisodeSyncRuns
} from '$lib/server/db/schema';
import {
	DEFAULT_NOTIFICATION_PROFILE,
	NOTIFICATION_USER_TYPE,
	episodeNotificationCopy,
	episodeNotificationDueDate,
	isEpisodeNotificationDue,
	normalizeNotificationOffset,
	normalizeNotificationTimezone,
	relevantTVSeasonNumbers,
	shiftDate,
	todayInTimezone,
	type TVNotificationOffset
} from '$lib/tv-notifications';
import { TMDBClient, evaluateTMDBIngestionSafety, type TMDBTVEpisode } from '$lib/server/tmdb';

const MAX_SYNC_BATCH = 20;
const MAX_INBOX_ITEMS = 100;
const MAX_PUSH_BATCH = 20;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function activeAccount(userId: string) {
	return sql`exists (select 1 from ${users} where ${users.id} = ${userId} and ${users.role} = 'owner' and ${users.disabledAt} is null)`;
}

function visibleNotification() {
	// An inbox item remains durable after a later sync failure or a paused
	// subscription; ownership and profile scoping still apply to every read.
	return sql`exists (select 1 from ${tvEpisodeSubscriptions} where ${tvEpisodeSubscriptions.id} = ${notificationEvents.subscriptionId} and ${tvEpisodeSubscriptions.userId} = ${notificationEvents.userId} and ${tvEpisodeSubscriptions.profileId} = ${notificationEvents.profileId})`;
}

async function requireActiveAccount(userId: string) {
	const [account] = await db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.id, userId), eq(users.role, 'owner'), isNull(users.disabledAt)))
		.limit(1);
	if (!account) throw new Error('An active owner account is required.');
}

type PushInput = {
	endpoint: string;
	keys: { p256dh: string; auth: string };
};

export type TVEpisodeSyncResult = {
	runId: string;
	processed: number;
	inserted: number;
	updated: number;
	skipped: number;
	failed: number;
	notificationsCreated: number;
	pushSent: number;
	complete: boolean;
};

function hash(value: unknown): string {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function safeError(error: unknown): string {
	const status =
		error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : null;
	return status && Number.isInteger(status)
		? `Remote request failed (${status}).`
		: 'Metadata or delivery request failed.';
}

function validAirDate(value: string | null): value is string {
	return Boolean(value && /^\d{4}-\d{2}-\d{2}$/u.test(value));
}

function cleanText(value: string, maxLength: number): string {
	return value.trim().replace(/\s+/gu, ' ').slice(0, maxLength);
}

export async function getTVEpisodeSubscription(userId: string, tmdbShowId: number) {
	await requireActiveAccount(userId);
	return db.query.tvEpisodeSubscriptions.findFirst({
		where: and(
			eq(tvEpisodeSubscriptions.userId, userId),
			eq(tvEpisodeSubscriptions.userType, NOTIFICATION_USER_TYPE),
			eq(tvEpisodeSubscriptions.profileId, DEFAULT_NOTIFICATION_PROFILE),
			eq(tvEpisodeSubscriptions.tmdbShowId, tmdbShowId)
		)
	});
}

export async function saveTVEpisodeSubscription(input: {
	userId: string;
	tmdbShowId: number;
	showTitle: string;
	posterPath: string | null;
	offsetDays: TVNotificationOffset;
	timezone: string;
}) {
	await requireActiveAccount(input.userId);
	if (!Number.isInteger(input.tmdbShowId) || input.tmdbShowId <= 0) {
		throw new RangeError('Invalid TV show identifier.');
	}
	const values = {
		userId: input.userId,
		userType: NOTIFICATION_USER_TYPE,
		profileId: DEFAULT_NOTIFICATION_PROFILE,
		tmdbShowId: input.tmdbShowId,
		showTitle: cleanText(input.showTitle, 255),
		posterPath: input.posterPath?.slice(0, 255) ?? null,
		offsetDays: normalizeNotificationOffset(input.offsetDays),
		timezone: normalizeNotificationTimezone(input.timezone),
		enabled: true,
		lastCheckStatus: 'pending' as const,
		lastError: null,
		nextCheckAt: new Date(),
		updatedAt: new Date()
	};
	const [saved] = await db
		.insert(tvEpisodeSubscriptions)
		.values(values)
		.onConflictDoUpdate({
			target: [
				tvEpisodeSubscriptions.userId,
				tvEpisodeSubscriptions.userType,
				tvEpisodeSubscriptions.profileId,
				tvEpisodeSubscriptions.tmdbShowId
			],
			set: {
				...values,
				monitoringSince: sql`case when ${tvEpisodeSubscriptions.enabled} then ${tvEpisodeSubscriptions.monitoringSince} else now() end`
			}
		})
		.returning();
	return saved;
}

export async function disableTVEpisodeSubscription(userId: string, tmdbShowId: number) {
	await requireActiveAccount(userId);
	const [disabled] = await db
		.update(tvEpisodeSubscriptions)
		.set({ enabled: false, updatedAt: new Date() })
		.where(
			and(
				eq(tvEpisodeSubscriptions.userId, userId),
				eq(tvEpisodeSubscriptions.userType, NOTIFICATION_USER_TYPE),
				eq(tvEpisodeSubscriptions.profileId, DEFAULT_NOTIFICATION_PROFILE),
				eq(tvEpisodeSubscriptions.tmdbShowId, tmdbShowId)
			)
		)
		.returning({ id: tvEpisodeSubscriptions.id });
	return Boolean(disabled);
}

export async function listTVEpisodeSubscriptions(userId: string) {
	await requireActiveAccount(userId);
	return db
		.select()
		.from(tvEpisodeSubscriptions)
		.where(
			and(
				eq(tvEpisodeSubscriptions.userId, userId),
				eq(tvEpisodeSubscriptions.userType, NOTIFICATION_USER_TYPE),
				eq(tvEpisodeSubscriptions.profileId, DEFAULT_NOTIFICATION_PROFILE)
			)
		)
		.orderBy(desc(tvEpisodeSubscriptions.enabled), asc(tvEpisodeSubscriptions.showTitle));
}

export async function updateTVEpisodeSubscription(input: {
	userId: string;
	subscriptionId: string;
	enabled: boolean;
	offsetDays: TVNotificationOffset;
	timezone: string;
}) {
	await requireActiveAccount(input.userId);
	const [updated] = await db
		.update(tvEpisodeSubscriptions)
		.set({
			enabled: input.enabled,
			monitoringSince: sql`case when ${tvEpisodeSubscriptions.enabled} then ${tvEpisodeSubscriptions.monitoringSince} else now() end`,
			offsetDays: normalizeNotificationOffset(input.offsetDays),
			timezone: normalizeNotificationTimezone(input.timezone),
			lastCheckStatus: input.enabled ? 'pending' : 'ok',
			lastError: null,
			nextCheckAt: new Date(),
			updatedAt: new Date()
		})
		.where(
			and(
				eq(tvEpisodeSubscriptions.id, input.subscriptionId),
				eq(tvEpisodeSubscriptions.userId, input.userId),
				eq(tvEpisodeSubscriptions.userType, NOTIFICATION_USER_TYPE),
				eq(tvEpisodeSubscriptions.profileId, DEFAULT_NOTIFICATION_PROFILE)
			)
		)
		.returning();
	return updated ?? null;
}

export async function listNotifications(userId: string, limit = MAX_INBOX_ITEMS) {
	await requireActiveAccount(userId);
	return db
		.select({ notification: notificationEvents, episode: tvEpisodeEvents })
		.from(notificationEvents)
		.innerJoin(tvEpisodeEvents, eq(notificationEvents.episodeEventId, tvEpisodeEvents.id))
		.where(
			and(
				eq(notificationEvents.userId, userId),
				eq(notificationEvents.userType, NOTIFICATION_USER_TYPE),
				visibleNotification(),
				eq(notificationEvents.profileId, DEFAULT_NOTIFICATION_PROFILE)
			)
		)
		.orderBy(desc(notificationEvents.createdAt))
		.limit(
			Number.isFinite(limit)
				? Math.max(1, Math.min(Math.floor(limit), MAX_INBOX_ITEMS))
				: MAX_INBOX_ITEMS
		);
}

export async function unreadNotificationCount(userId: string) {
	await requireActiveAccount(userId);
	const [result] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(notificationEvents)
		.where(
			and(
				eq(notificationEvents.userId, userId),
				eq(notificationEvents.userType, NOTIFICATION_USER_TYPE),
				visibleNotification(),
				eq(notificationEvents.profileId, DEFAULT_NOTIFICATION_PROFILE),
				isNull(notificationEvents.readAt)
			)
		);
	return result?.count ?? 0;
}

export async function markNotificationRead(userId: string, notificationId: string | null) {
	await requireActiveAccount(userId);
	const where = and(
		eq(notificationEvents.userId, userId),
		eq(notificationEvents.userType, NOTIFICATION_USER_TYPE),
		eq(notificationEvents.profileId, DEFAULT_NOTIFICATION_PROFILE),
		isNull(notificationEvents.readAt),
		notificationId ? eq(notificationEvents.id, notificationId) : undefined
	);
	const changed = await db
		.update(notificationEvents)
		.set({ readAt: new Date(), updatedAt: new Date() })
		.where(where)
		.returning({ id: notificationEvents.id });
	return changed.length;
}

export function validatePushInput(value: unknown): PushInput {
	if (!value || typeof value !== 'object') throw new RangeError('Invalid push subscription.');
	const candidate = value as Record<string, unknown>;
	const keys = candidate.keys as Record<string, unknown> | undefined;
	if (
		typeof candidate.endpoint !== 'string' ||
		candidate.endpoint.length > 2_048 ||
		typeof keys?.p256dh !== 'string' ||
		keys.p256dh.length > 512 ||
		typeof keys.auth !== 'string' ||
		keys.auth.length > 512
	) {
		throw new RangeError('Invalid push subscription.');
	}
	let endpoint: URL;
	try {
		endpoint = new URL(candidate.endpoint);
	} catch {
		throw new RangeError('Invalid push endpoint.');
	}
	// Only browser push providers may receive server-side requests, never arbitrary URLs.
	const host = endpoint.hostname;
	const approved =
		host === 'fcm.googleapis.com' ||
		host === 'updates.push.services.mozilla.com' ||
		host === 'push.services.mozilla.com' ||
		host === 'web.push.apple.com' ||
		/^[a-z0-9-]+\.notify\.windows\.com$/u.test(host);
	if (
		!approved ||
		endpoint.protocol !== 'https:' ||
		endpoint.port ||
		endpoint.username ||
		endpoint.password ||
		endpoint.hash
	) {
		throw new RangeError('Unsupported browser push endpoint.');
	}
	if (
		!/^[A-Za-z0-9_-]+={0,2}$/u.test(keys.p256dh) ||
		!/^[A-Za-z0-9_-]+={0,2}$/u.test(keys.auth) ||
		Buffer.from(keys.p256dh, 'base64url').length !== 65 ||
		Buffer.from(keys.p256dh, 'base64url')[0] !== 4 ||
		Buffer.from(keys.auth, 'base64url').length !== 16
	)
		throw new RangeError('Invalid push keys.');
	return { endpoint: endpoint.toString(), keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export async function savePushSubscription(
	userId: string,
	input: PushInput,
	userAgent: string | null
) {
	await requireActiveAccount(userId);
	input = validatePushInput(input);
	const endpointHash = hash(input.endpoint);
	const values = {
		userId,
		userType: NOTIFICATION_USER_TYPE,
		profileId: DEFAULT_NOTIFICATION_PROFILE,
		endpoint: input.endpoint,
		endpointHash,
		p256dh: input.keys.p256dh,
		auth: input.keys.auth,
		userAgent: userAgent?.slice(0, 512) ?? null,
		enabled: true,
		failureCount: 0,
		updatedAt: new Date()
	};
	await db
		.insert(pushSubscriptions)
		.values(values)
		.onConflictDoUpdate({
			target: pushSubscriptions.endpointHash,
			set: values,
			setWhere: eq(pushSubscriptions.userId, userId)
		});
}

export async function removePushSubscription(userId: string, endpoint: string) {
	await requireActiveAccount(userId);
	const removed = await db
		.delete(pushSubscriptions)
		.where(
			and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpointHash, hash(endpoint)))
		)
		.returning({ id: pushSubscriptions.id });
	return removed.length > 0;
}

function configureWebPush(): boolean {
	const subject = process.env.VAPID_SUBJECT?.trim();
	const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
	const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
	if (!subject || !publicKey || !privateKey) return false;
	try {
		webPush.setVapidDetails(subject, publicKey, privateKey);
		return true;
	} catch {
		return false;
	}
}

export async function deliverPendingTVPush(
	now = new Date(),
	deadline = Date.now() + 20_000
): Promise<number> {
	if (!configureWebPush()) return 0;
	// A crashed sender may have reached the provider. Preserve that uncertainty rather than duplicate it.
	await db
		.update(pushNotificationDeliveries)
		.set({
			status: 'uncertain',
			lastError: 'Delivery acknowledgement was not recorded.',
			updatedAt: now
		})
		.where(
			and(
				eq(pushNotificationDeliveries.status, 'sending'),
				lte(pushNotificationDeliveries.claimedAt, new Date(now.getTime() - 120_000))
			)
		);
	const pending = await db
		.select({
			delivery: pushNotificationDeliveries,
			notification: notificationEvents,
			device: pushSubscriptions
		})
		.from(pushNotificationDeliveries)
		.innerJoin(
			notificationEvents,
			eq(pushNotificationDeliveries.notificationId, notificationEvents.id)
		)
		.innerJoin(
			pushSubscriptions,
			eq(pushNotificationDeliveries.pushSubscriptionId, pushSubscriptions.id)
		)
		.where(
			and(
				inArray(pushNotificationDeliveries.status, ['queued', 'retry']),
				lte(pushNotificationDeliveries.nextAttemptAt, now)
			)
		)
		.orderBy(asc(pushNotificationDeliveries.nextAttemptAt), asc(pushNotificationDeliveries.id))
		.limit(MAX_PUSH_BATCH);
	let sent = 0;
	for (const { delivery, notification, device } of pending) {
		if (Date.now() >= deadline) break;
		const [claim] = await db
			.update(pushNotificationDeliveries)
			.set({
				status: 'sending',
				claimedAt: now,
				attemptCount: sql`${pushNotificationDeliveries.attemptCount} + 1`,
				updatedAt: now
			})
			.where(
				and(
					eq(pushNotificationDeliveries.id, delivery.id),
					inArray(pushNotificationDeliveries.status, ['queued', 'retry']),
					lte(pushNotificationDeliveries.nextAttemptAt, now)
				)
			)
			.returning();
		if (!claim) continue;
		const [active] = await db
			.select({ id: tvEpisodeSubscriptions.id })
			.from(tvEpisodeSubscriptions)
			.innerJoin(pushSubscriptions, eq(pushSubscriptions.id, device.id))
			.where(
				and(
					eq(tvEpisodeSubscriptions.id, notification.subscriptionId),
					eq(tvEpisodeSubscriptions.enabled, true),
					eq(tvEpisodeSubscriptions.lastCheckStatus, 'ok'),
					eq(tvEpisodeSubscriptions.userId, notification.userId),
					eq(tvEpisodeSubscriptions.userType, NOTIFICATION_USER_TYPE),
					eq(tvEpisodeSubscriptions.profileId, notification.profileId),
					eq(pushSubscriptions.userId, notification.userId),
					eq(pushSubscriptions.userType, NOTIFICATION_USER_TYPE),
					eq(pushSubscriptions.profileId, notification.profileId),
					eq(pushSubscriptions.enabled, true),
					activeAccount(notification.userId)
				)
			)
			.limit(1);
		if (!active || now.getTime() - notification.createdAt.getTime() > 2 * 86_400_000) {
			await db
				.update(pushNotificationDeliveries)
				.set({ status: 'cancelled', updatedAt: now })
				.where(eq(pushNotificationDeliveries.id, delivery.id));
			await db
				.update(notificationEvents)
				.set({
					pushStatus: sql`case
						when exists (select 1 from ${pushNotificationDeliveries} where ${pushNotificationDeliveries.notificationId} = ${notification.id} and ${pushNotificationDeliveries.status} in ('queued', 'retry', 'sending')) then 'pending'
						when exists (select 1 from ${pushNotificationDeliveries} where ${pushNotificationDeliveries.notificationId} = ${notification.id} and ${pushNotificationDeliveries.status} in ('failed', 'uncertain')) then 'failed'
						else 'not_subscribed' end`,
					updatedAt: now
				})
				.where(eq(notificationEvents.id, notification.id));
			continue;
		}
		let status: 'sent' | 'retry' | 'failed' | 'uncertain' = 'sent';
		let lastError: string | null = null;
		try {
			const input = validatePushInput({
				endpoint: device.endpoint,
				keys: { p256dh: device.p256dh, auth: device.auth }
			});
			await webPush.sendNotification(
				input,
				JSON.stringify({
					title: notification.title,
					body: notification.body,
					url: notification.targetPath,
					tag: `episode-${notification.id}`,
					notificationId: notification.id
				}),
				{ TTL: 86_400, urgency: 'normal', timeout: 5_000 }
			);
			sent += 1;
			await db
				.update(pushSubscriptions)
				.set({ failureCount: 0, lastSuccessAt: now, updatedAt: now })
				.where(eq(pushSubscriptions.id, device.id));
		} catch (error) {
			lastError = safeError(error);
			const code =
				error && typeof error === 'object' && 'statusCode' in error
					? Number(error.statusCode)
					: null;
			// Only an explicit rejection can be retried; transport failures have an unknown delivery outcome.
			status =
				code === 429 || code === 503
					? claim.attemptCount < 5
						? 'retry'
						: 'failed'
					: code || error instanceof RangeError
						? 'failed'
						: 'uncertain';
			await db
				.update(pushSubscriptions)
				.set({
					enabled:
						code === 404 || code === 410 || error instanceof RangeError ? false : device.enabled,
					failureCount: sql`${pushSubscriptions.failureCount} + 1`,
					updatedAt: now
				})
				.where(eq(pushSubscriptions.id, device.id));
		}
		await db
			.update(pushNotificationDeliveries)
			.set({
				status,
				lastError,
				sentAt: status === 'sent' ? now : null,
				nextAttemptAt: new Date(
					now.getTime() + Math.min(3_600_000, 60_000 * 2 ** claim.attemptCount)
				),
				updatedAt: now
			})
			.where(
				and(
					eq(pushNotificationDeliveries.id, delivery.id),
					eq(pushNotificationDeliveries.status, 'sending')
				)
			);
		await db
			.update(notificationEvents)
			.set({
				pushStatus: sql`case
				when exists (select 1 from ${pushNotificationDeliveries} where ${pushNotificationDeliveries.notificationId} = ${notification.id} and ${pushNotificationDeliveries.status} in ('queued', 'retry', 'sending')) then 'pending'
				when exists (select 1 from ${pushNotificationDeliveries} where ${pushNotificationDeliveries.notificationId} = ${notification.id} and ${pushNotificationDeliveries.status} in ('failed', 'uncertain')) then 'failed'
				else 'sent' end`,
				pushAttemptCount: sql`${notificationEvents.pushAttemptCount} + 1`,
				lastPushAttemptAt: now,
				lastPushError: lastError,
				updatedAt: now
			})
			.where(eq(notificationEvents.id, notification.id));
	}
	return sent;
}

async function synchronizeSubscription(
	subscription: typeof tvEpisodeSubscriptions.$inferSelect,
	client: TMDBClient,
	now: Date
) {
	const show = await client.getTVDetails(subscription.tmdbShowId);
	const safety = evaluateTMDBIngestionSafety(show);
	if (!safety.allowed) {
		await db
			.update(tvEpisodeSubscriptions)
			.set({
				lastCheckStatus: 'rejected',
				lastError: `TMDB metadata rejected: ${safety.reason}.`,
				updatedAt: now
			})
			.where(eq(tvEpisodeSubscriptions.id, subscription.id));
		return { inserted: 0, updated: 0, skipped: 1, notificationsCreated: 0, pushSent: 0 };
	}
	const seasons = await Promise.all(
		relevantTVSeasonNumbers(show, todayInTimezone(now, subscription.timezone)).map((seasonNumber) =>
			client.getTVSeasonDetails(show.id, seasonNumber)
		)
	);
	const today = todayInTimezone(now, subscription.timezone);
	const windowEnd = shiftDate(today, 90);
	const episodes = seasons
		.flatMap((season) => season.episodes)
		.filter(
			(episode) =>
				!episode.air_date ||
				(validAirDate(episode.air_date) &&
					episode.air_date >= shiftDate(today, -1) &&
					episode.air_date <= windowEnd)
		)
		.slice(0, 100);
	let inserted = 0;
	let updated = 0;
	let notificationsCreated = 0;

	for (const episode of episodes) {
		const sourceHash = hash({
			showId: show.id,
			showTitle: show.name,
			season: episode.season_number,
			episode: episode.episode_number,
			name: episode.name,
			airDate: episode.air_date
		});
		const existing = await db.query.tvEpisodeEvents.findFirst({
			where: and(
				eq(tvEpisodeEvents.tmdbShowId, show.id),
				eq(tvEpisodeEvents.seasonNumber, episode.season_number),
				eq(tvEpisodeEvents.episodeNumber, episode.episode_number)
			)
		});
		const [event] = await db
			.insert(tvEpisodeEvents)
			.values({
				tmdbShowId: show.id,
				showTitle: cleanText(show.name, 255),
				seasonNumber: episode.season_number,
				episodeNumber: episode.episode_number,
				episodeName: cleanText(episode.name || `Episode ${episode.episode_number}`, 255),
				airDate: episode.air_date,
				sourceHash,
				lastSeenAt: now,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: [
					tvEpisodeEvents.tmdbShowId,
					tvEpisodeEvents.seasonNumber,
					tvEpisodeEvents.episodeNumber
				],
				set: {
					showTitle: cleanText(show.name, 255),
					episodeName: cleanText(episode.name || `Episode ${episode.episode_number}`, 255),
					airDate: episode.air_date,
					sourceHash,
					lastSeenAt: now,
					updatedAt: now
				}
			})
			.returning();
		if (!event) continue;
		if (!existing) inserted += 1;
		else if (existing.sourceHash !== sourceHash) updated += 1;

		if (
			!episode.air_date ||
			episode.air_date < todayInTimezone(subscription.monitoringSince, subscription.timezone) ||
			!isEpisodeNotificationDue({
				airDate: episode.air_date,
				offsetDays: subscription.offsetDays as TVNotificationOffset,
				timezone: subscription.timezone,
				now
			})
		) {
			continue;
		}
		const copy = episodeNotificationCopy(
			show.name,
			episode as TMDBTVEpisode,
			subscription.timezone,
			now
		);
		const airDate = episode.air_date;
		const notification = await db.transaction(async (tx) => {
			const [active] = await tx
				.select({ id: tvEpisodeSubscriptions.id })
				.from(tvEpisodeSubscriptions)
				.where(
					and(
						eq(tvEpisodeSubscriptions.id, subscription.id),
						eq(tvEpisodeSubscriptions.enabled, true),
						activeAccount(subscription.userId)
					)
				)
				.for('update');
			if (!active) return null;
			const [created] = await tx
				.insert(notificationEvents)
				.values({
					userId: subscription.userId,
					userType: subscription.userType,
					profileId: subscription.profileId,
					subscriptionId: subscription.id,
					episodeEventId: event.id,
					offsetDays: subscription.offsetDays,
					dueDate: episodeNotificationDueDate(
						airDate,
						subscription.offsetDays as TVNotificationOffset
					),
					title: cleanText(copy.title, 255),
					body: copy.body,
					targetPath: `/tv/${show.id}?season=${episode.season_number}&episode=${episode.episode_number}`,
					createdAt: now,
					updatedAt: now
				})
				.onConflictDoNothing()
				.returning();
			if (!created) return null;
			const devices = await tx
				.select({ id: pushSubscriptions.id })
				.from(pushSubscriptions)
				.where(
					and(
						eq(pushSubscriptions.userId, subscription.userId),
						eq(pushSubscriptions.userType, NOTIFICATION_USER_TYPE),
						eq(pushSubscriptions.profileId, subscription.profileId),
						eq(pushSubscriptions.enabled, true)
					)
				)
				.limit(20);
			if (devices.length)
				await tx
					.insert(pushNotificationDeliveries)
					.values(
						devices.map((device) => ({
							notificationId: created.id,
							pushSubscriptionId: device.id,
							nextAttemptAt: now
						}))
					)
					.onConflictDoNothing();
			else
				await tx
					.update(notificationEvents)
					.set({ pushStatus: 'not_subscribed' })
					.where(eq(notificationEvents.id, created.id));
			return created;
		});
		if (notification) {
			notificationsCreated += 1;
		}
	}

	await db
		.update(tvEpisodeSubscriptions)
		.set({
			showTitle: cleanText(show.name, 255),
			posterPath: show.poster_path,
			lastSuccessfulCheckAt: now,
			lastCheckStatus: 'ok',
			lastError: null,
			updatedAt: now
		})
		.where(eq(tvEpisodeSubscriptions.id, subscription.id));
	return {
		inserted,
		updated,
		skipped: episodes.length === 0 ? 1 : 0,
		notificationsCreated,
		pushSent: 0
	};
}

export async function syncTVEpisodeNotifications(
	input: {
		triggeredBy?: 'cron' | 'manual';
		now?: Date;
		client?: TMDBClient;
		batchSize?: number;
	} = {}
): Promise<TVEpisodeSyncResult> {
	const now = input.now ?? new Date();
	const batchSize = Number.isFinite(input.batchSize)
		? Math.max(1, Math.min(Math.floor(input.batchSize!), MAX_SYNC_BATCH))
		: MAX_SYNC_BATCH;
	const client = input.client ?? new TMDBClient({ timeoutMs: 3_000, maxRetries: 1 });
	const deadline = Date.now() + 45_000;
	const [run] = await db
		.insert(tvEpisodeSyncRuns)
		.values({ triggeredBy: input.triggeredBy ?? 'cron' })
		.returning({ id: tvEpisodeSyncRuns.id });
	if (!run) throw new Error('TV notification sync run could not be created.');
	const subscriptions = await db
		.select({ subscription: tvEpisodeSubscriptions })
		.from(tvEpisodeSubscriptions)
		.innerJoin(users, eq(tvEpisodeSubscriptions.userId, users.id))
		.where(
			and(
				eq(tvEpisodeSubscriptions.enabled, true),
				eq(users.role, 'owner'),
				isNull(users.disabledAt),
				eq(tvEpisodeSubscriptions.profileId, DEFAULT_NOTIFICATION_PROFILE),
				lte(tvEpisodeSubscriptions.nextCheckAt, now)
			)
		)
		.orderBy(asc(tvEpisodeSubscriptions.nextCheckAt), asc(tvEpisodeSubscriptions.id))
		.limit(batchSize + 1);
	let inserted = 0;
	let updated = 0;
	let skipped = 0;
	let failed = 0;
	let notificationsCreated = 0;
	let pushSent = 0;
	const errors: Array<{ subscriptionId: string; message: string }> = [];
	let processed = 0;

	for (const { subscription } of subscriptions.slice(0, batchSize)) {
		if (Date.now() > deadline - 20_000) break;
		const [claim] = await db
			.update(tvEpisodeSubscriptions)
			.set({ nextCheckAt: new Date(now.getTime() + CHECK_INTERVAL_MS), lastAttemptAt: now })
			.where(
				and(
					eq(tvEpisodeSubscriptions.id, subscription.id),
					eq(tvEpisodeSubscriptions.enabled, true),
					lte(tvEpisodeSubscriptions.nextCheckAt, now)
				)
			)
			.returning({ id: tvEpisodeSubscriptions.id });
		if (!claim) continue;
		processed += 1;
		try {
			const result = await synchronizeSubscription(subscription, client, now);
			inserted += result.inserted;
			updated += result.updated;
			skipped += result.skipped;
			notificationsCreated += result.notificationsCreated;
			pushSent += result.pushSent;
		} catch (error) {
			failed += 1;
			const message = safeError(error);
			errors.push({ subscriptionId: subscription.id, message });
			await db
				.update(tvEpisodeSubscriptions)
				.set({ lastCheckStatus: 'failed', lastError: message, updatedAt: now })
				.where(eq(tvEpisodeSubscriptions.id, subscription.id));
		}
	}
	pushSent += await deliverPendingTVPush(now, deadline);
	const complete = failed === 0 && processed >= subscriptions.length;
	const status =
		failed === 0
			? complete
				? 'complete'
				: 'partial'
			: failed === processed
				? 'failed'
				: 'partial';
	await db
		.update(tvEpisodeSyncRuns)
		.set({
			status,
			processed,
			inserted,
			updated,
			skipped,
			failed,
			notificationsCreated,
			pushSent,
			errors,
			completedAt: now,
			updatedAt: now
		})
		.where(eq(tvEpisodeSyncRuns.id, run.id));
	return {
		runId: run.id,
		processed,
		inserted,
		updated,
		skipped,
		failed,
		notificationsCreated,
		pushSent,
		complete
	};
}

export async function recentNotificationsAfter(userId: string, after: Date) {
	await requireActiveAccount(userId);
	return db
		.select({
			id: notificationEvents.id,
			title: notificationEvents.title,
			body: notificationEvents.body,
			targetPath: notificationEvents.targetPath,
			createdAt: notificationEvents.createdAt
		})
		.from(notificationEvents)
		.where(
			and(
				eq(notificationEvents.userId, userId),
				eq(notificationEvents.userType, NOTIFICATION_USER_TYPE),
				visibleNotification(),
				eq(notificationEvents.profileId, DEFAULT_NOTIFICATION_PROFILE),
				gt(notificationEvents.createdAt, after)
			)
		)
		.orderBy(asc(notificationEvents.createdAt))
		.limit(20);
}
