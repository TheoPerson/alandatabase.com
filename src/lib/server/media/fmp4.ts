// Incremental reader for the fragmented MP4 that ffmpeg writes to stdout.
// It splits the byte stream into the init segment (ftyp + moov) and fragments (moof + mdat),
// and reads just enough of each box to place a fragment on the timeline. Bytes are never altered
// except the mfhd sequence number, which is renumbered so it keeps increasing across restarts.

export interface TrackInfo {
	id: number;
	kind: 'video' | 'audio' | 'other';
	timescale: number;
}

export interface TrafInfo {
	trackId: number;
	baseDecodeTime: number; // tfdt, in the track timescale
	firstCompositionOffset: number; // trun first sample composition offset (0 when absent)
	sampleCount: number;
	duration: number; // sum of sample durations in the track timescale (best effort)
}

export interface Fragment {
	bytes: Uint8Array; // moof + mdat
	trafs: TrafInfo[];
}

type Box = { type: string; start: number; headerLength: number; end: number };

function readU32(buf: Uint8Array, offset: number): number {
	return (
		buf[offset] * 0x1000000 + ((buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3])
	);
}

function readU64(buf: Uint8Array, offset: number): number {
	return readU32(buf, offset) * 0x100000000 + readU32(buf, offset + 4);
}

function readI32(buf: Uint8Array, offset: number): number {
	const v = readU32(buf, offset);
	return v >= 0x80000000 ? v - 0x100000000 : v;
}

function boxType(buf: Uint8Array, offset: number): string {
	return String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
}

/** Reads one box header at `offset`; null when the header is incomplete. */
export function readBoxHeader(buf: Uint8Array, offset: number, limit = buf.length): Box | null {
	if (offset + 8 > limit) return null;
	let size = readU32(buf, offset);
	const type = boxType(buf, offset + 4);
	let headerLength = 8;
	if (size === 1) {
		if (offset + 16 > limit) return null;
		size = readU64(buf, offset + 8);
		headerLength = 16;
	} else if (size === 0) {
		size = limit - offset; // box runs to the end of the container
	}
	if (size < headerLength) throw new Error(`Invalid MP4 box size for ${type}`);
	return { type, start: offset, headerLength, end: offset + size };
}

function* boxes(buf: Uint8Array, start: number, end: number): Generator<Box> {
	let offset = start;
	while (offset < end) {
		const box = readBoxHeader(buf, offset, end);
		if (!box || box.end > end) return;
		yield box;
		offset = box.end;
	}
}

function child(buf: Uint8Array, parent: Box, type: string): Box | null {
	for (const box of boxes(buf, parent.start + parent.headerLength, parent.end)) {
		if (box.type === type) return box;
	}
	return null;
}

/** Track ids, kinds and timescales from an init segment (ftyp + moov). */
export function parseInitTracks(init: Uint8Array): TrackInfo[] {
	const tracks: TrackInfo[] = [];
	for (const top of boxes(init, 0, init.length)) {
		if (top.type !== 'moov') continue;
		for (const trak of boxes(init, top.start + top.headerLength, top.end)) {
			if (trak.type !== 'trak') continue;
			const tkhd = child(init, trak, 'tkhd');
			const mdia = child(init, trak, 'mdia');
			if (!tkhd || !mdia) continue;
			const tkhdBody = tkhd.start + tkhd.headerLength;
			const version = init[tkhdBody];
			const id = readU32(init, tkhdBody + (version === 1 ? 20 : 12));
			const mdhd = child(init, mdia, 'mdhd');
			const hdlr = child(init, mdia, 'hdlr');
			let timescale = 1;
			if (mdhd) {
				const body = mdhd.start + mdhd.headerLength;
				timescale = readU32(init, body + (init[body] === 1 ? 20 : 12));
			}
			const handler = hdlr ? boxType(init, hdlr.start + hdlr.headerLength + 8) : '';
			tracks.push({
				id,
				timescale,
				kind: handler === 'vide' ? 'video' : handler === 'soun' ? 'audio' : 'other'
			});
		}
	}
	return tracks;
}

function parseTraf(buf: Uint8Array, traf: Box): TrafInfo | null {
	const tfhd = child(buf, traf, 'tfhd');
	if (!tfhd) return null;
	const tfhdBody = tfhd.start + tfhd.headerLength;
	const tfhdFlags = (buf[tfhdBody + 1] << 16) | (buf[tfhdBody + 2] << 8) | buf[tfhdBody + 3];
	const trackId = readU32(buf, tfhdBody + 4);
	let cursor = tfhdBody + 8;
	if (tfhdFlags & 0x01) cursor += 8; // base data offset
	if (tfhdFlags & 0x02) cursor += 4; // sample description index
	const defaultDuration = tfhdFlags & 0x08 ? readU32(buf, cursor) : 0;

	let baseDecodeTime = 0;
	const tfdt = child(buf, traf, 'tfdt');
	if (tfdt) {
		const body = tfdt.start + tfdt.headerLength;
		baseDecodeTime = buf[body] === 1 ? readU64(buf, body + 4) : readU32(buf, body + 4);
	}

	let firstCompositionOffset = 0;
	let sampleCount = 0;
	let duration = 0;
	for (const trun of boxes(buf, traf.start + traf.headerLength, traf.end)) {
		if (trun.type !== 'trun') continue;
		const body = trun.start + trun.headerLength;
		const version = buf[body];
		const flags = (buf[body + 1] << 16) | (buf[body + 2] << 8) | buf[body + 3];
		const count = readU32(buf, body + 4);
		let p = body + 8;
		if (flags & 0x01) p += 4; // data offset
		if (flags & 0x04) p += 4; // first sample flags
		for (let i = 0; i < count; i++) {
			if (flags & 0x100) {
				duration += readU32(buf, p);
				p += 4;
			} else duration += defaultDuration;
			if (flags & 0x200) p += 4;
			if (flags & 0x400) p += 4;
			if (flags & 0x800) {
				const cto = version === 0 ? readU32(buf, p) : readI32(buf, p);
				if (sampleCount === 0 && i === 0) firstCompositionOffset = cto;
				p += 4;
			}
		}
		sampleCount += count;
	}
	return { trackId, baseDecodeTime, firstCompositionOffset, sampleCount, duration };
}

/** Rewrites the mfhd sequence number of a moof (in place). */
export function setFragmentSequence(fragment: Uint8Array, sequence: number): void {
	const moof = readBoxHeader(fragment, 0);
	if (!moof || moof.type !== 'moof') return;
	const mfhd = child(fragment, moof, 'mfhd');
	if (!mfhd) return;
	const p = mfhd.start + mfhd.headerLength + 4;
	fragment[p] = (sequence >>> 24) & 0xff;
	fragment[p + 1] = (sequence >>> 16) & 0xff;
	fragment[p + 2] = (sequence >>> 8) & 0xff;
	fragment[p + 3] = sequence & 0xff;
}

export function parseFragment(bytes: Uint8Array): Fragment {
	const trafs: TrafInfo[] = [];
	for (const top of boxes(bytes, 0, bytes.length)) {
		if (top.type !== 'moof') continue;
		for (const traf of boxes(bytes, top.start + top.headerLength, top.end)) {
			if (traf.type !== 'traf') continue;
			const info = parseTraf(bytes, traf);
			if (info) trafs.push(info);
		}
	}
	return { bytes, trafs };
}

/**
 * Push-based splitter: feed stdout chunks, receive the init segment once and then each fragment.
 * Boxes other than ftyp/moov/moof/mdat (free, sidx, styp, prft, mfra) are dropped.
 */
export class Fmp4Splitter {
	// Pending bytes are kept as a chunk list and joined once per box, so a 30 MB 4K mdat costs one
	// copy instead of one copy per 64 KB pipe read.
	private chunks: Uint8Array[] = [];
	private pending = 0;
	private nextBox: { type: string; size: number } | null = null;
	private initParts: Uint8Array[] = [];
	private pendingMoof: Uint8Array | null = null;
	private initDone = false;

	constructor(
		private readonly onInit: (init: Uint8Array) => void,
		private readonly onFragment: (fragment: Fragment) => void
	) {}

	private take(length: number): Uint8Array {
		const out = new Uint8Array(length);
		let filled = 0;
		while (filled < length) {
			const head = this.chunks[0];
			const need = length - filled;
			if (head.length <= need) {
				out.set(head, filled);
				filled += head.length;
				this.chunks.shift();
			} else {
				out.set(head.subarray(0, need), filled);
				this.chunks[0] = head.subarray(need);
				filled += need;
			}
		}
		this.pending -= length;
		return out;
	}

	private peek(length: number): Uint8Array {
		if (this.chunks[0].length >= length) return this.chunks[0].subarray(0, length);
		const out = new Uint8Array(length);
		let filled = 0;
		for (const c of this.chunks) {
			const n = Math.min(c.length, length - filled);
			out.set(c.subarray(0, n), filled);
			filled += n;
			if (filled === length) break;
		}
		return out;
	}

	push(chunk: Uint8Array): void {
		if (chunk.length === 0) return;
		this.chunks.push(chunk);
		this.pending += chunk.length;
		for (;;) {
			if (!this.nextBox) {
				if (this.pending < 8) return;
				const head = this.peek(Math.min(16, this.pending));
				const header = readBoxHeader(head, 0, Number.MAX_SAFE_INTEGER);
				if (!header || (readU32(head, 0) === 1 && head.length < 16)) return;
				if (readU32(head, 0) === 0) throw new Error('Unbounded MP4 box on a stream');
				this.nextBox = { type: header.type, size: header.end - header.start };
			}
			if (this.pending < this.nextBox.size) return;
			const { type, size } = this.nextBox;
			this.nextBox = null;
			this.handleBox(type, this.take(size));
		}
	}

	private handleBox(type: string, bytes: Uint8Array): void {
		if (!this.initDone && (type === 'ftyp' || type === 'moov')) {
			this.initParts.push(bytes);
			if (type === 'moov') {
				this.initDone = true;
				const total = this.initParts.reduce((n, p) => n + p.length, 0);
				const init = new Uint8Array(total);
				let o = 0;
				for (const p of this.initParts) {
					init.set(p, o);
					o += p.length;
				}
				this.initParts = [];
				this.onInit(init);
			}
			return;
		}
		if (type === 'moof') {
			this.pendingMoof = bytes;
			return;
		}
		if (type === 'mdat' && this.pendingMoof) {
			const fragment = new Uint8Array(this.pendingMoof.length + bytes.length);
			fragment.set(this.pendingMoof, 0);
			fragment.set(bytes, this.pendingMoof.length);
			this.pendingMoof = null;
			this.onFragment(parseFragment(fragment));
		}
	}
}
