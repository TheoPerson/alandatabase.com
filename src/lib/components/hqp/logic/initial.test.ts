import { describe, expect, it } from 'vitest';
import type { HqpItem, HqpLaunchPayload } from '$lib/player/hqp/types';
import { initialClock, openingSnapshot } from './initial';

const item = (fileId: string, duration: number | null): HqpItem => ({
	fileId,
	kind: 'movie',
	title: fileId,
	showTitle: null,
	seasonNumber: null,
	episodeNumber: null,
	overview: null,
	year: 2020,
	runtimeMinutes: 100,
	originalLanguage: 'en',
	artwork: { stillPath: null, backdropPath: null, posterPath: null, logoPath: null },
	titleHref: '/movies/1',
	file: {
		fileId,
		durationSeconds: duration,
		resolution: '1080p',
		hdr: 'sdr',
		audio: [],
		subtitles: []
	},
	progress: null
});

describe('openingSnapshot', () => {
	it('starts in the opening state on the launch item', () => {
		const launch: HqpLaunchPayload = {
			queue: [item('a', 60), item('b', 90)],
			index: 1,
			returnHref: '/'
		};
		const snap = openingSnapshot(launch);
		expect(snap.status).toBe('starting');
		expect(snap.item?.fileId).toBe('b');
		expect(snap.index).toBe(1);
		expect(snap.error).toBeNull();
		expect(snap.chapterIndex).toBe(-1);
	});

	it('clamps a bad index and survives an empty queue', () => {
		expect(openingSnapshot({ queue: [item('a', 60)], index: 9, returnHref: '/' }).index).toBe(0);
		expect(openingSnapshot({ queue: [], index: 0, returnHref: '/' }).item).toBeNull();
	});
});

describe('initialClock', () => {
	it('uses the probed duration until the engine reports one', () => {
		expect(initialClock({ queue: [item('a', 3600)], index: 0, returnHref: '/' }).duration).toBe(
			3600
		);
		expect(initialClock({ queue: [item('a', null)], index: 0, returnHref: '/' }).duration).toBe(0);
	});
});
