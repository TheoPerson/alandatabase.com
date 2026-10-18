import { describe, expect, it } from 'vitest';
import { decideQuality, levelBitrate, type AbrInput } from './abr';

const MIN = 60_000;
const NOW = 100 * MIN;
const ALL = ['original', '2160p', '1080p', '720p', '480p'] as const;

function input(over: Partial<AbrInput> = {}): AbrInput {
	return {
		now: NOW,
		choice: 'auto',
		active: 'original',
		available: [...ALL],
		lastSwitchAt: NOW - 10 * MIN,
		stalls: [],
		bufferAhead: 20,
		throughput: null,
		bitrate: null,
		remaining: 3600,
		paused: false,
		seeking: false,
		...over
	};
}

const stall = (startAgo: number, length: number | null, seek = false) => ({
	start: NOW - startAgo,
	end: length === null ? null : NOW - startAgo + length,
	seek
});

describe('decideQuality: step down', () => {
	it('steps down one level after one stall over 4 s (ended or ongoing)', () => {
		expect(decideQuality(input({ stalls: [stall(20_000, 4_500)] }))).toEqual({
			action: 'down',
			to: '2160p'
		});
		expect(decideQuality(input({ active: '2160p', stalls: [stall(4_200, null)] }))).toEqual({
			action: 'down',
			to: '1080p'
		});
		expect(decideQuality(input({ stalls: [stall(20_000, 3_900)] }))).toEqual({ action: 'none' });
	});

	it('steps down after two stalls over 1 s within 60 s', () => {
		const two = [stall(50_000, 1_500), stall(10_000, 1_200)];
		expect(decideQuality(input({ stalls: two }))).toEqual({ action: 'down', to: '2160p' });
		const spread = [stall(70_000, 1_500), stall(10_000, 1_200)];
		expect(decideQuality(input({ stalls: spread }))).toEqual({ action: 'none' });
		const short = [stall(50_000, 900), stall(10_000, 1_200)];
		expect(decideQuality(input({ stalls: short }))).toEqual({ action: 'none' });
	});

	it('ignores stalls caused by seeks and stalls before the last switch', () => {
		expect(decideQuality(input({ stalls: [stall(20_000, 9_000, true)] }))).toEqual({
			action: 'none'
		});
		expect(
			decideQuality(input({ lastSwitchAt: NOW - 40_000, stalls: [stall(50_000, 9_000)] }))
		).toEqual({ action: 'none' });
	});

	it('hls.js: steps down when throughput is under 1.1x the bitrate with under 8 s buffered', () => {
		const slow = { throughput: 10e6, bitrate: 10e6, delivery: 'hls.js' as const };
		expect(decideQuality(input({ ...slow, bufferAhead: 5 }))).toEqual({
			action: 'down',
			to: '2160p'
		});
		expect(decideQuality(input({ ...slow, bufferAhead: 9 }))).toEqual({ action: 'none' });
		expect(decideQuality(input({ ...slow, throughput: 11.5e6, bufferAhead: 5 }))).toEqual({
			action: 'none'
		});
	});

	it('never goes below the lowest level', () => {
		expect(decideQuality(input({ active: '480p', stalls: [stall(20_000, 9_000)] }))).toEqual({
			action: 'none'
		});
	});
});

describe('decideQuality: step up', () => {
	const calm = { active: '1080p' as const, lastSwitchAt: NOW - 4 * MIN };

	it('native: steps up with 180 s since the switch, 120 s without stall, 45 s buffered, 5 min left', () => {
		expect(decideQuality(input({ ...calm, bufferAhead: 45 }))).toEqual({
			action: 'up',
			to: '2160p'
		});
		expect(decideQuality(input({ ...calm, bufferAhead: 44 }))).toEqual({ action: 'none' });
		expect(decideQuality(input({ ...calm, bufferAhead: 60, lastSwitchAt: NOW - 170_000 }))).toEqual(
			{ action: 'none' }
		);
		expect(
			decideQuality(input({ ...calm, bufferAhead: 60, stalls: [stall(110_000, 500)] }))
		).toEqual({ action: 'none' });
		expect(decideQuality(input({ ...calm, bufferAhead: 60, remaining: 300 }))).toEqual({
			action: 'none'
		});
	});

	it('hls.js: needs 1.6x the target bitrate sustained for 60 s', () => {
		const target = levelBitrate('2160p', null);
		const base = { ...calm, delivery: 'hls.js' as const, throughput: 50e6, bitrate: 8e6 };
		expect(decideQuality(input({ ...base, sustainedThroughput: target * 1.6 }))).toEqual({
			action: 'up',
			to: '2160p'
		});
		expect(decideQuality(input({ ...base, sustainedThroughput: target * 1.5 }))).toEqual({
			action: 'none'
		});
		expect(decideQuality(input({ ...base, sustainedThroughput: null }))).toEqual({
			action: 'none'
		});
	});

	it('uses the measured original bitrate when stepping back to Original', () => {
		const base = {
			active: '2160p' as const,
			lastSwitchAt: NOW - 4 * MIN,
			delivery: 'hls.js' as const,
			throughput: 90e6,
			bitrate: 20e6,
			originalBitrate: 50e6
		};
		expect(decideQuality(input({ ...base, sustainedThroughput: 80e6 }))).toEqual({
			action: 'up',
			to: 'original'
		});
		expect(decideQuality(input({ ...base, sustainedThroughput: 79e6 }))).toEqual({
			action: 'none'
		});
	});

	it('never steps above the first level', () => {
		expect(decideQuality(input({ lastSwitchAt: NOW - 10 * MIN, bufferAhead: 90 }))).toEqual({
			action: 'none'
		});
	});
});

describe('decideQuality: guards', () => {
	it('switches at most once per 30 s, never paused or seeking', () => {
		const bad = { stalls: [stall(5_000, 4_500)] };
		expect(decideQuality(input({ ...bad, lastSwitchAt: NOW - 29_000 }))).toEqual({
			action: 'none'
		});
		expect(decideQuality(input({ ...bad, paused: true }))).toEqual({ action: 'none' });
		expect(decideQuality(input({ ...bad, seeking: true }))).toEqual({ action: 'none' });
	});

	it('an explicit level never switches; it suggests after two stalls over 4 s within 2 min', () => {
		const one = [stall(100_000, 5_000)];
		const two = [stall(100_000, 5_000), stall(20_000, 4_500)];
		const explicit = { choice: 'original' as const };
		expect(decideQuality(input({ ...explicit, stalls: one }))).toEqual({ action: 'none' });
		expect(decideQuality(input({ ...explicit, stalls: two }))).toEqual({
			action: 'suggest',
			to: '2160p'
		});
		const old = [stall(130_000, 5_000), stall(20_000, 4_500)];
		expect(decideQuality(input({ ...explicit, stalls: old }))).toEqual({ action: 'none' });
		expect(
			decideQuality(input({ choice: '1080p', active: '1080p', stalls: two, bufferAhead: 90 }))
		).toEqual({ action: 'suggest', to: '720p' });
	});
});
