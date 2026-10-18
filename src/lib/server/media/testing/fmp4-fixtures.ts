// Synthetic fragmented-MP4 bytes for unit tests: just the boxes the splitter, the segment
// assembler and the codec-string reader look at.

function u32(value: number): number[] {
	return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function u64(value: number): number[] {
	const high = Math.floor(value / 0x100000000);
	return [...u32(high), ...u32(value >>> 0)];
}

function ascii(text: string): number[] {
	return [...text].map((c) => c.charCodeAt(0));
}

export function box(type: string, ...parts: Array<number[] | Uint8Array>): Uint8Array {
	const body = parts.flatMap((p) => Array.from(p));
	return Uint8Array.from([...u32(8 + body.length), ...ascii(type), ...body]);
}

export interface FixtureTrack {
	id: number;
	kind: 'vide' | 'soun';
	timescale: number;
	sampleEntry?: Uint8Array; // stsd entry (e.g. hvc1 with hvcC); optional
}

function trak(track: FixtureTrack): Uint8Array {
	const tkhd = box('tkhd', u32(0), u32(0), u32(0), u32(track.id), new Array(68).fill(0));
	const mdhd = box('mdhd', u32(0), u32(0), u32(0), u32(track.timescale), u32(0), u32(0));
	const hdlr = box('hdlr', u32(0), u32(0), ascii(track.kind), new Array(13).fill(0));
	const stsd = box('stsd', u32(0), u32(track.sampleEntry ? 1 : 0), track.sampleEntry ?? []);
	const minf = box('minf', box('stbl', stsd));
	return box('trak', tkhd, box('mdia', mdhd, hdlr, minf));
}

export function initSegment(tracks: FixtureTrack[]): Uint8Array {
	const ftyp = box('ftyp', ascii('isom'), u32(512), ascii('isomiso6mp41'));
	const moov = box('moov', box('mvhd', new Array(100).fill(0)), ...tracks.map(trak));
	return concat([ftyp, moov]);
}

export interface FixtureTraf {
	trackId: number;
	decodeTime: number; // tfdt, track timescale
	durations: number[]; // per sample
	compositionOffsets?: number[]; // per sample
}

export function fragment(sequence: number, trafs: FixtureTraf[], payload = 16): Uint8Array {
	const trafBoxes = trafs.map((t) => {
		const hasCto = !!t.compositionOffsets;
		const flags = 0x001 | 0x100 | (hasCto ? 0x800 : 0);
		const samples = t.durations.flatMap((d, i) => [
			...u32(d),
			...(hasCto ? u32(t.compositionOffsets![i] ?? 0) : [])
		]);
		return box(
			'traf',
			box('tfhd', u32(0x020000), u32(t.trackId)),
			box('tfdt', [1, 0, 0, 0], u64(t.decodeTime)),
			box('trun', u32(flags), u32(t.durations.length), u32(0), samples)
		);
	});
	const moof = box('moof', box('mfhd', u32(0), u32(sequence)), ...trafBoxes);
	const mdat = box('mdat', new Array(payload).fill(0xab));
	return concat([moof, mdat]);
}

export function concat(parts: Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.length;
	}
	return out;
}

/** hvc1 sample entry with an hvcC for Main 10, level 5.1 (153), high-tier flag off. */
export function hvc1Entry(): Uint8Array {
	const hvcC = box('hvcC', [
		1, // configurationVersion
		0x02, // profile space 0, tier 0, profile idc 2 (Main 10)
		0x20,
		0x00,
		0x00,
		0x00, // compatibility flags (bit-reversed 0x4)
		0x90,
		0x00,
		0x00,
		0x00,
		0x00,
		0x00, // constraint flags
		153, // level
		...new Array(10).fill(0)
	]);
	const visual = new Array(78).fill(0);
	visual[24] = 0x0f; // width 3840
	visual[25] = 0x00;
	visual[26] = 0x06; // height 1600
	visual[27] = 0x40;
	return box('hvc1', visual, hvcC);
}

export function ec3Entry(): Uint8Array {
	return box('ec-3', new Array(28).fill(0), box('dec3', [0, 0, 0]));
}
