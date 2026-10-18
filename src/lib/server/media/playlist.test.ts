import { describe, expect, it } from 'vitest';
import { codecsFromInit, masterPlaylist, mediaPlaylist } from './playlist';
import { ec3Entry, hvc1Entry, initSegment } from './testing/fmp4-fixtures';

describe('mediaPlaylist', () => {
	it('lists every segment of the whole file with real durations (VOD)', () => {
		const text = mediaPlaylist([0, 6.542, 16.542], 20);
		expect(text.split('\n')).toEqual([
			'#EXTM3U',
			'#EXT-X-VERSION:7',
			'#EXT-X-TARGETDURATION:10',
			'#EXT-X-MEDIA-SEQUENCE:0',
			'#EXT-X-PLAYLIST-TYPE:VOD',
			'#EXT-X-INDEPENDENT-SEGMENTS',
			'#EXT-X-MAP:URI="init.mp4"',
			'#EXTINF:6.542000,',
			'seg-0.m4s',
			'#EXTINF:10.000000,',
			'seg-1.m4s',
			'#EXTINF:3.458000,',
			'seg-2.m4s',
			'#EXT-X-ENDLIST',
			''
		]);
	});

	it('rounds the target duration up so every EXTINF fits', () => {
		expect(mediaPlaylist([0, 10.43], 20.5)).toContain('#EXT-X-TARGETDURATION:11');
		expect(mediaPlaylist([0, 4, 8], 12)).toContain('#EXT-X-TARGETDURATION:4');
	});
});

describe('masterPlaylist', () => {
	it('advertises codecs, size, frame rate and HDR range', () => {
		expect(
			masterPlaylist({
				codecs: ['hvc1.2.4.L153.90', 'ec-3'],
				bandwidth: 30_000_000,
				averageBandwidth: 12_000_000,
				width: 3840,
				height: 1600,
				frameRate: 23.976,
				videoRange: 'PQ'
			})
		).toBe(
			'#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXT-X-STREAM-INF:BANDWIDTH=30000000,AVERAGE-BANDWIDTH=12000000,CODECS="hvc1.2.4.L153.90,ec-3",RESOLUTION=3840x1600,FRAME-RATE=23.976,VIDEO-RANGE=PQ\nindex.m3u8\n'
		);
	});

	it('omits optional attributes', () => {
		const text = masterPlaylist({
			codecs: ['avc1.640028', 'mp4a.40.2'],
			bandwidth: 8e6,
			width: 1920,
			height: 1080,
			frameRate: null,
			videoRange: 'SDR'
		});
		expect(text).not.toContain('FRAME-RATE');
		expect(text).not.toContain('AVERAGE-BANDWIDTH');
	});
});

describe('codecsFromInit', () => {
	it('reads RFC 6381 strings from the init segment, video first', () => {
		const init = initSegment([
			{ id: 2, kind: 'soun', timescale: 48000, sampleEntry: ec3Entry() },
			{ id: 1, kind: 'vide', timescale: 16000, sampleEntry: hvc1Entry() }
		]);
		expect(codecsFromInit(init)).toEqual(['hvc1.2.4.L153.90', 'ec-3']);
	});
});
