import { describe, expect, it } from 'vitest';
import type { PlaybackSession } from '$lib/media/types';
import {
	bufferAhead,
	bufferedEndAt,
	bufferedRanges,
	buildMetrics,
	estimateRefreshRate
} from './metrics';
import { createFakeMedia, FakeWindow } from './testing/fake-media';
import type { HqpAudioOption, HqpItem, HqpSubtitleState } from './types';

describe('buffer maths', () => {
	it('reads ranges and the end of the range holding the position', () => {
		const media = createFakeMedia();
		media.setBuffered([
			[0, 10],
			[20, 50]
		]);
		const ranges = bufferedRanges(media);
		expect(ranges).toEqual([
			[0, 10],
			[20, 50]
		]);
		expect(bufferedEndAt(ranges, 25)).toBe(50);
		expect(bufferedEndAt(ranges, 15)).toBe(15);
		expect(bufferAhead(ranges, 25)).toBe(25);
		expect(bufferAhead(ranges, 15)).toBe(0);
	});
});

describe('refresh rate', () => {
	it('estimates from 30 animation frames (median interval)', async () => {
		const win = new FakeWindow();
		const pending = estimateRefreshRate((cb) => win.requestAnimationFrame(cb));
		for (let i = 0; i <= 30; i++) win.frame(1000 + i * (1000 / 120) + (i === 7 ? 9 : 0));
		await expect(pending).resolves.toBe(120);
		await expect(estimateRefreshRate(null)).resolves.toBeNull();
	});
});

const session: PlaybackSession = {
	sessionId: '0123456789abcdef0123456789abcdef',
	playlistUrl: '/api/media/sessions/x/index.m3u8',
	durationSeconds: 3600,
	segmentSeconds: 4,
	audio: 1,
	audioTracks: [],
	subtitleTracks: [],
	video: { mode: 'copy', codec: 'hevc', width: 3840, height: 2160, hdr: true, reason: 'Original' },
	quality: 'original',
	audioMode: 'transcode'
};

describe('buildMetrics', () => {
	it('collects session, stream, buffer, frames and screen facts with no path', () => {
		const media = createFakeMedia();
		media.setBuffered([[0, 130]]);
		media.currentTime = 100;
		media.fake.frames = { droppedVideoFrames: 3, totalVideoFrames: 2400 };
		const audio: HqpAudioOption = {
			ordinal: 1,
			label: 'English 5.1',
			language: 'eng',
			title: null,
			channels: 6,
			codec: null,
			isOriginal: true,
			selected: true
		};
		const subtitles: HqpSubtitleState = {
			options: [
				{
					ordinal: 2,
					label: 'French',
					language: 'fre',
					title: null,
					forced: true,
					sdh: false,
					isText: true,
					url: '/s/2.vtt'
				}
			],
			selected: null,
			forced: 2,
			offsetSeconds: 0
		};
		const metrics = buildMetrics({
			video: media,
			session,
			delivery: 'hls.js',
			item: { file: { hdr: 'hdr10' } } as unknown as HqpItem,
			hdrShown: false,
			audio: [audio],
			subtitles,
			stats: { bitrate: 24e6, throughput: 300e6, sustained: null },
			quality: { choice: 'auto', active: 'original' },
			screen: { width: 440, height: 956, dpr: 3, refreshHz: 120, hdr: true }
		});
		expect(metrics).toEqual({
			sessionId: session.sessionId,
			delivery: 'hls.js',
			videoMode: 'copy',
			reason: 'Original',
			codec: 'hevc',
			profile: null,
			width: 3840,
			height: 2160,
			frameRate: null,
			bitDepth: 10,
			hdr: 'hdr10',
			hdrShown: false,
			audio: { label: 'English 5.1', codec: null, channels: 6, mode: 'transcode' },
			subtitles: 'WebVTT · French forced',
			segmentSeconds: 4,
			bitrate: { measured: 24e6, file: null },
			throughput: 300e6,
			bufferAhead: 30,
			frames: { dropped: 3, total: 2400 },
			screen: { width: 440, height: 956, dpr: 3, refreshHz: 120, hdr: true },
			quality: { choice: 'auto', active: 'original' }
		});
		expect(JSON.stringify(metrics)).not.toMatch(/[A-Z]:\\|\/MOVIES/);
	});

	it('shows dashes (nulls) before a session exists', () => {
		const media = createFakeMedia();
		const metrics = buildMetrics({
			video: media,
			session: null,
			delivery: null,
			item: null,
			hdrShown: false,
			audio: [],
			subtitles: { options: [], selected: null, forced: null, offsetSeconds: 0 },
			stats: null,
			quality: { choice: 'auto', active: null },
			screen: { width: 1, height: 1, dpr: 1, refreshHz: null, hdr: false }
		});
		expect(metrics).toMatchObject({
			sessionId: null,
			videoMode: null,
			codec: null,
			bitDepth: null,
			hdr: 'sdr',
			subtitles: null,
			segmentSeconds: null,
			throughput: null,
			bufferAhead: 0
		});
	});
});
