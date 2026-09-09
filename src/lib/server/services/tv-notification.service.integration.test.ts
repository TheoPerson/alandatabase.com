import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import type { TMDBClient } from '$lib/server/tmdb';

const dependencies = vi.hoisted(() => ({
	database: {} as object,
	send: vi.fn(),
	configure: vi.fn()
}));
vi.mock('$lib/server/db', () => ({
	db: new Proxy({}, { get: (_, key) => Reflect.get(dependencies.database, key) })
}));
vi.mock('web-push', () => ({
	default: { setVapidDetails: dependencies.configure, sendNotification: dependencies.send }
}));

import {
	deliverPendingTVPush,
	listNotifications,
	markNotificationRead,
	savePushSubscription,
	saveTVEpisodeSubscription,
	syncTVEpisodeNotifications,
	updateTVEpisodeSubscription,
	validatePushInput
} from './tv-notification.service';

const owner = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
const now = new Date('2026-09-06T12:00:00.000Z');
let pg: PGlite;
let database: ReturnType<typeof drizzle<typeof schema>>;
const keys = {
	p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'),
	auth: Buffer.alloc(16, 2).toString('base64url')
};
const show = {
	id: 123,
	name: 'Example Show',
	adult: false,
	keywords: { keywords: [] },
	poster_path: null,
	seasons: [{ season_number: 1, air_date: '2026-09-06' }],
	next_episode_to_air: { season_number: 1 },
	last_episode_to_air: null
};
function client(airDate: string | null = '2026-09-06') {
	return {
		getTVDetails: vi.fn().mockResolvedValue(show),
		getTVSeasonDetails: vi.fn().mockResolvedValue({
			episodes: [
				{ id: 1234, name: 'Pilot', season_number: 1, episode_number: 1, air_date: airDate }
			]
		})
	} as unknown as TMDBClient;
}
async function subscribe() {
	const value = await saveTVEpisodeSubscription({
		userId: owner,
		tmdbShowId: 123,
		showTitle: 'Example Show',
		posterPath: null,
		offsetDays: 0,
		timezone: 'Europe/Paris'
	});
	await database
		.update(schema.tvEpisodeSubscriptions)
		.set({ nextCheckAt: now, monitoringSince: now })
		.where(eq(schema.tvEpisodeSubscriptions.id, value.id));
	return value;
}
async function device(suffix = 'one') {
	await savePushSubscription(
		owner,
		{ endpoint: `https://fcm.googleapis.com/fcm/send/${suffix}`, keys },
		null
	);
}

beforeAll(async () => {
	pg = new PGlite();
	await pg.exec(
		'create table users (id uuid primary key, role varchar(20), disabled_at timestamp);'
	);
	await pg.exec(await readFile(resolve('drizzle/0006_tv_episode_notifications.sql'), 'utf8'));
	database = drizzle(pg, { schema });
	dependencies.database = database;
}, 30_000);
afterAll(async () => {
	await pg?.close();
	vi.unstubAllEnvs();
});
beforeEach(async () => {
	await pg.exec('truncate users cascade');
	await pg.query("insert into users (id, role) values ($1, 'owner'), ($2, 'member')", [
		owner,
		member
	]);
	dependencies.send.mockReset().mockResolvedValue({ statusCode: 201 });
	vi.stubEnv('VAPID_SUBJECT', 'mailto:preview@example.test');
	vi.stubEnv('VAPID_PUBLIC_KEY', 'test-only-public');
	vi.stubEnv('VAPID_PRIVATE_KEY', 'test-only-private');
});

describe('TV notification persistence and delivery', () => {
	it('creates one durable event and device delivery across repeated and overlapping syncs', async () => {
		await subscribe();
		await device();
		await Promise.all([
			syncTVEpisodeNotifications({ now, client: client() }),
			syncTVEpisodeNotifications({ now, client: client() })
		]);
		await deliverPendingTVPush(now);
		expect(await database.select().from(schema.notificationEvents)).toHaveLength(1);
		expect(await database.select().from(schema.pushNotificationDeliveries)).toHaveLength(1);
		expect(dependencies.send).toHaveBeenCalledTimes(1);
		const calls = dependencies.send.mock.calls[0];
		expect(JSON.parse(calls[1]).url).toBe('/tv/123?season=1&episode=1');
	});

	it('retries only the failed device after explicit rate limiting', async () => {
		await subscribe();
		await device('one');
		await device('two');
		dependencies.send
			.mockRejectedValueOnce({ statusCode: 429 })
			.mockResolvedValue({ statusCode: 201 });
		await syncTVEpisodeNotifications({ now, client: client() });
		expect(dependencies.send).toHaveBeenCalledTimes(2);
		await deliverPendingTVPush(new Date(now.getTime() + 300_000));
		expect(dependencies.send).toHaveBeenCalledTimes(3);
		expect(
			(await database.select().from(schema.pushNotificationDeliveries)).map((row) => row.status)
		).toEqual(['sent', 'sent']);
	});

	it('does not replay uncertain network outcomes or expired sending leases', async () => {
		await subscribe();
		await device();
		dependencies.send.mockRejectedValue(new Error('timeout containing a secret URL'));
		await syncTVEpisodeNotifications({ now, client: client() });
		await deliverPendingTVPush(new Date(now.getTime() + 300_000));
		expect(dependencies.send).toHaveBeenCalledTimes(1);
		const [delivery] = await database.select().from(schema.pushNotificationDeliveries);
		expect(delivery.status).toBe('uncertain');
		expect(delivery.lastError).not.toContain('secret');
		await database
			.update(schema.pushNotificationDeliveries)
			.set({ status: 'sending', claimedAt: now });
		await deliverPendingTVPush(new Date(now.getTime() + 300_000));
		expect(dependencies.send).toHaveBeenCalledTimes(1);
	});

	it('keeps notifications durable without VAPID and delivers once configuration becomes available', async () => {
		await subscribe();
		await device();
		vi.stubEnv('VAPID_PRIVATE_KEY', '');
		await syncTVEpisodeNotifications({ now, client: client() });
		expect(await listNotifications(owner)).toHaveLength(1);
		expect(dependencies.send).not.toHaveBeenCalled();
		vi.stubEnv('VAPID_PRIVATE_KEY', 'test-only-private');
		await deliverPendingTVPush(now);
		expect(dependencies.send).toHaveBeenCalledTimes(1);
	});

	it('blocks disabled accounts, members and cross-account inbox changes', async () => {
		await expect(
			saveTVEpisodeSubscription({
				userId: member,
				tmdbShowId: 123,
				showTitle: 'Example',
				posterPath: null,
				offsetDays: 0,
				timezone: 'UTC'
			})
		).rejects.toThrow('active owner');
		await subscribe();
		await device();
		await database.execute(
			sql`update users set disabled_at = ${now.toISOString()} where id = ${owner}`
		);
		expect((await syncTVEpisodeNotifications({ now, client: client() })).processed).toBe(0);
		await expect(listNotifications(owner)).rejects.toThrow('active owner');
		await expect(markNotificationRead(member, null)).rejects.toThrow('active owner');
		expect(dependencies.send).not.toHaveBeenCalled();
	});

	it('cancels queued deliveries when the series is disabled', async () => {
		const subscription = await subscribe();
		await device();
		vi.stubEnv('VAPID_PRIVATE_KEY', '');
		await syncTVEpisodeNotifications({ now, client: client() });
		await updateTVEpisodeSubscription({
			userId: owner,
			subscriptionId: subscription.id,
			enabled: false,
			offsetDays: 0,
			timezone: 'Europe/Paris'
		});
		vi.stubEnv('VAPID_PRIVATE_KEY', 'test-only-private');
		await deliverPendingTVPush(now);
		expect(dependencies.send).not.toHaveBeenCalled();
		expect((await database.select().from(schema.pushNotificationDeliveries))[0].status).toBe(
			'cancelled'
		);
	});

	it('does not notify unknown dates or episodes predating monitoring', async () => {
		await subscribe();
		await syncTVEpisodeNotifications({ now, client: client(null) });
		expect(await database.select().from(schema.tvEpisodeEvents)).toHaveLength(1);
		expect(await database.select().from(schema.notificationEvents)).toHaveLength(0);
		await database.update(schema.tvEpisodeSubscriptions).set({ nextCheckAt: now });
		await syncTVEpisodeNotifications({ now, client: client('2026-09-05') });
		expect(await database.select().from(schema.notificationEvents)).toHaveLength(0);
	});

	it('rejects arbitrary endpoints and malformed encryption keys', () => {
		for (const endpoint of [
			'https://127.0.0.1/push',
			'https://internal.example/push',
			'https://fcm.googleapis.com.evil.test/push',
			'https://user:password@fcm.googleapis.com/push'
		]) {
			expect(() => validatePushInput({ endpoint, keys })).toThrow();
		}
		expect(() =>
			validatePushInput({
				endpoint: 'https://fcm.googleapis.com/fcm/send/one',
				keys: { p256dh: 'bad', auth: 'bad' }
			})
		).toThrow();
	});
});
