// Minimal ISO-BMFF reader for what HLS needs from our own ffmpeg output:
// RFC 6381 codec strings from init.mp4 (for the master playlist CODECS attribute).

export interface Box {
	type: string;
	start: number; // offset of the box header
	dataStart: number; // offset of the payload
	end: number; // offset after the box
}

export function readBoxes(buf: Uint8Array, start = 0, end = buf.length): Box[] {
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const boxes: Box[] = [];
	let pos = start;
	while (pos + 8 <= end) {
		let size = view.getUint32(pos);
		const type = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
		let header = 8;
		if (size === 1) {
			if (pos + 16 > end) break;
			size = Number(view.getBigUint64(pos + 8));
			header = 16;
		} else if (size === 0) {
			size = end - pos;
		}
		if (size < header || pos + size > end) break;
		boxes.push({ type, start: pos, dataStart: pos + header, end: pos + size });
		pos += size;
	}
	return boxes;
}

function child(buf: Uint8Array, parent: Box, type: string, skip = 0): Box | undefined {
	return readBoxes(buf, parent.dataStart + skip, parent.end).find((b) => b.type === type);
}

function path(buf: Uint8Array, root: Box | undefined, types: string[]): Box | undefined {
	let cur = root;
	for (const type of types) {
		if (!cur) return undefined;
		cur = child(buf, cur, type);
	}
	return cur;
}

const hex = (n: number) => n.toString(16).toUpperCase();

/** hvcC -> "hvc1.2.4.L153.B0" (ISO/IEC 14496-15 Annex E). */
export function hevcCodecString(buf: Uint8Array, hvcC: Box, fourcc: string): string {
	const p = hvcC.dataStart;
	const b1 = buf[p + 1];
	const space = ['', 'A', 'B', 'C'][b1 >> 6];
	const tier = b1 & 0x20 ? 'H' : 'L';
	const profile = b1 & 0x1f;
	// Compatibility flags are written bit-reversed.
	let compat = 0;
	const raw = ((buf[p + 2] << 24) | (buf[p + 3] << 16) | (buf[p + 4] << 8) | buf[p + 5]) >>> 0;
	for (let i = 0; i < 32; i++) if (raw & (1 << i)) compat |= 1 << (31 - i);
	compat >>>= 0;
	const level = buf[p + 12];
	const constraints = Array.from(buf.subarray(p + 6, p + 12));
	while (constraints.length && constraints[constraints.length - 1] === 0) constraints.pop();
	const constraintPart = constraints.map((c) => `.${hex(c)}`).join('');
	return `${fourcc}.${space}${profile}.${hex(compat)}.${tier}${level}${constraintPart}`;
}

/** avcC -> "avc1.640028". */
export function avcCodecString(buf: Uint8Array, avcC: Box, fourcc: string): string {
	const p = avcC.dataStart;
	const two = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
	return `${fourcc}.${two(buf[p + 1])}${two(buf[p + 2])}${two(buf[p + 3])}`;
}

/** av1C -> "av01.0.12M.10". */
export function av1CodecString(buf: Uint8Array, av1C: Box): string {
	const p = av1C.dataStart;
	const profile = buf[p + 1] >> 5;
	const level = buf[p + 1] & 0x1f;
	const tier = buf[p + 2] & 0x80 ? 'H' : 'M';
	const highBitdepth = Boolean(buf[p + 2] & 0x40);
	const twelveBit = Boolean(buf[p + 2] & 0x20);
	const depth = highBitdepth ? (twelveBit ? 12 : 10) : 8;
	return `av01.${profile}.${String(level).padStart(2, '0')}${tier}.${String(depth).padStart(2, '0')}`;
}

/** esds -> "mp4a.40.2" (or .5 / .29 for HE-AAC). */
export function aacCodecString(buf: Uint8Array, esds: Box): string {
	// Walk the descriptors to the DecoderSpecificInfo (tag 5).
	let pos = esds.dataStart + 4; // full box
	const end = esds.end;
	const readLen = () => {
		let len = 0;
		for (let i = 0; i < 4; i++) {
			const b = buf[pos++];
			len = (len << 7) | (b & 0x7f);
			if (!(b & 0x80)) break;
		}
		return len;
	};
	let objectType = 0x40;
	while (pos < end) {
		const tag = buf[pos++];
		const len = readLen();
		if (tag === 3) {
			const flags = buf[pos + 2];
			pos += 3;
			if (flags & 0x80) pos += 2;
			if (flags & 0x40) pos += 1 + buf[pos];
			if (flags & 0x20) pos += 2;
		} else if (tag === 4) {
			objectType = buf[pos];
			pos += 13;
		} else if (tag === 5) {
			let aot = buf[pos] >> 3;
			if (aot === 31) aot = 32 + (((buf[pos] & 7) << 3) | (buf[pos + 1] >> 5));
			return `mp4a.${hex(objectType).toLowerCase()}.${aot}`;
		} else {
			pos += len;
		}
	}
	return 'mp4a.40.2';
}

export interface InitTrackInfo {
	trackId: number;
	handler: 'vide' | 'soun' | string;
	timescale: number;
	codec: string; // RFC 6381
	width?: number;
	height?: number;
}

/** Reads every track of an init segment: id, timescale and codec string. */
export function parseInitSegment(buf: Uint8Array): InitTrackInfo[] {
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const moov = readBoxes(buf).find((b) => b.type === 'moov');
	if (!moov) return [];
	const tracks: InitTrackInfo[] = [];
	for (const trak of readBoxes(buf, moov.dataStart, moov.end).filter((b) => b.type === 'trak')) {
		const tkhd = child(buf, trak, 'tkhd');
		const mdhd = path(buf, trak, ['mdia', 'mdhd']);
		const hdlr = path(buf, trak, ['mdia', 'hdlr']);
		const stsd = path(buf, trak, ['mdia', 'minf', 'stbl', 'stsd']);
		if (!tkhd || !mdhd || !hdlr || !stsd) continue;
		const tkhdVersion = buf[tkhd.dataStart];
		const trackId = view.getUint32(tkhd.dataStart + (tkhdVersion === 1 ? 20 : 12));
		const mdhdVersion = buf[mdhd.dataStart];
		const timescale = view.getUint32(mdhd.dataStart + (mdhdVersion === 1 ? 20 : 12));
		const handler = String.fromCharCode(...buf.subarray(hdlr.dataStart + 8, hdlr.dataStart + 12));
		const entry = readBoxes(buf, stsd.dataStart + 8, stsd.end)[0];
		if (!entry) continue;
		const fourcc = entry.type;
		let codec = fourcc;
		let width: number | undefined;
		let height: number | undefined;
		if (handler === 'vide') {
			width = view.getUint16(entry.dataStart + 24);
			height = view.getUint16(entry.dataStart + 26);
			const inner = readBoxes(buf, entry.dataStart + 78, entry.end);
			const hvcC = inner.find((b) => b.type === 'hvcC');
			const avcC = inner.find((b) => b.type === 'avcC');
			const av1C = inner.find((b) => b.type === 'av1C');
			if (hvcC) codec = hevcCodecString(buf, hvcC, fourcc);
			else if (avcC) codec = avcCodecString(buf, avcC, fourcc);
			else if (av1C) codec = av1CodecString(buf, av1C);
		} else if (handler === 'soun') {
			if (fourcc === 'mp4a') {
				const inner = readBoxes(buf, entry.dataStart + 28, entry.end);
				const esds = inner.find((b) => b.type === 'esds');
				codec = esds ? aacCodecString(buf, esds) : 'mp4a.40.2';
			} else if (fourcc === 'ec-3' || fourcc === 'ac-3') {
				codec = fourcc;
			}
		}
		tracks.push({ trackId, handler, timescale, codec, width, height });
	}
	return tracks;
}
