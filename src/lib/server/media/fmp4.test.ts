import { describe, expect, it } from 'vitest';
import {
	Fmp4Splitter,
	parseFragment,
	parseInitTracks,
	readBoxHeader,
	setFragmentSequence
} from './fmp4';
import { readMkvCueKeyframes, parseCueTimes, readVint } from './mkv-cues';
import { box, concat, fragment, initSegment } from './testing/fmp4-fixtures';

const INIT = initSegment([
	{ id: 1, kind: 'vide', timescale: 16000 },
	{ id: 2, kind: 'soun', timescale: 48000 }
]);

function frag(seq: number, t: number) {
	return fragment(seq, [
		{
			trackId: 1,
			decodeTime: t * 16000,
			durations: [667, 667, 666],
			compositionOffsets: [1334, 0, 0]
		},
		{ trackId: 2, decodeTime: t * 48000, durations: [1024, 1024] }
	]);
}

describe('Fmp4Splitter', () => {
	it('emits the init segment and each moof+mdat even when boxes span many small chunks', () => {
		const stream = concat([INIT, box('free', [1, 2, 3]), frag(1, 0), frag(2, 4), frag(3, 8)]);
		const inits: Uint8Array[] = [];
		const fragments: ReturnType<typeof parseFragment>[] = [];
		const splitter = new Fmp4Splitter(
			(init) => inits.push(init),
			(f) => fragments.push(f)
		);
		for (let i = 0; i < stream.length; i += 7) splitter.push(stream.subarray(i, i + 7));
		expect(inits).toHaveLength(1);
		expect(inits[0]).toEqual(INIT);
		expect(fragments).toHaveLength(3);
		expect(fragments[1].bytes).toEqual(frag(2, 4));
		expect(fragments[1].trafs).toEqual([
			{
				trackId: 1,
				baseDecodeTime: 64000,
				firstCompositionOffset: 1334,
				sampleCount: 3,
				duration: 2000
			},
			{
				trackId: 2,
				baseDecodeTime: 192000,
				firstCompositionOffset: 0,
				sampleCount: 2,
				duration: 2048
			}
		]);
	});

	it('reads track ids, kinds and timescales from the init segment', () => {
		expect(parseInitTracks(INIT)).toEqual([
			{ id: 1, kind: 'video', timescale: 16000 },
			{ id: 2, kind: 'audio', timescale: 48000 }
		]);
	});

	it('renumbers the fragment sequence in place', () => {
		const bytes = frag(1, 0);
		setFragmentSequence(bytes, 5001);
		expect(bytes).toEqual(frag(5001, 0));
	});

	it('reads 64-bit box sizes and refuses unbounded boxes on a stream', () => {
		const large = Uint8Array.from([
			0,
			0,
			0,
			1,
			...'mdat'.split('').map((c) => c.charCodeAt(0)),
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			20,
			1,
			2,
			3,
			4
		]);
		expect(readBoxHeader(large, 0)).toEqual({ type: 'mdat', start: 0, headerLength: 16, end: 20 });
		const splitter = new Fmp4Splitter(
			() => undefined,
			() => undefined
		);
		expect(() => splitter.push(Uint8Array.from([0, 0, 0, 0, 0x6d, 0x64, 0x61, 0x74]))).toThrow();
	});
});

describe('Matroska cues', () => {
	it('decodes EBML variable-length integers', () => {
		expect(readVint(Uint8Array.from([0x81]), 0, false)).toEqual({
			value: 1,
			length: 1,
			unknown: false
		});
		expect(readVint(Uint8Array.from([0x40, 0x02]), 0, false)).toEqual({
			value: 2,
			length: 2,
			unknown: false
		});
		expect(readVint(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]), 0, true)?.value).toBe(0x1a45dfa3);
		expect(readVint(Uint8Array.from([0xff]), 0, false)?.unknown).toBe(true);
	});

	it('keeps cue times of the video track only', () => {
		// CuePoint { CueTime, CueTrackPositions { CueTrack } }
		const point = (time: number, track: number) => [
			0xbb,
			0x80 | 9,
			0xb3,
			0x82,
			(time >> 8) & 0xff,
			time & 0xff,
			0xb7,
			0x83,
			0xf7,
			0x81,
			track
		];
		const cues = Uint8Array.from([
			...point(4000, 1),
			...point(0, 1),
			...point(2000, 2),
			...point(4000, 1)
		]);
		expect(parseCueTimes(cues, 1)).toEqual([0, 4000]);
	});

	it('returns null for a file that is not Matroska', async () => {
		const path = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, '$1');
		expect(await readMkvCueKeyframes(path)).toBeNull();
	});
});
