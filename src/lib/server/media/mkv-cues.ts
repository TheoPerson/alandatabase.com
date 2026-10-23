// Reads the keyframe times of a Matroska file's video track from its Cues element.
// The Cues are the demuxer's own seek index: a cue time is exactly where `ffmpeg -ss` can land,
// so cutting segments only at cue times keeps direct-stream segments seekable and exact.
// Reading them costs a few small reads (header + SeekHead + Cues), not a full pass over the file.

import { open, type FileHandle } from 'node:fs/promises';

const ID_EBML = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const ID_SEEKHEAD = 0x114d9b74;
const ID_SEEK = 0x4dbb;
const ID_SEEK_ID = 0x53ab;
const ID_SEEK_POSITION = 0x53ac;
const ID_INFO = 0x1549a966;
const ID_TIMESTAMP_SCALE = 0x2ad7b1;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACK_ENTRY = 0xae;
const ID_TRACK_NUMBER = 0xd7;
const ID_TRACK_TYPE = 0x83;
const ID_CUES = 0x1c53bb6b;
const ID_CUE_POINT = 0xbb;
const ID_CUE_TIME = 0xb3;
const ID_CUE_TRACK_POSITIONS = 0xb7;
const ID_CUE_TRACK = 0xf7;
const ID_CLUSTER = 0x1f43b675;

const HEAD_BYTES = 256 * 1024;
const MAX_ELEMENT_BYTES = 64 * 1024 * 1024;

export interface EbmlElement {
	id: number;
	/** Offset of the element's data (after the header). */
	dataOffset: number;
	/** Data size; null when the size is "unknown" (live-style). */
	size: number | null;
	/** Offset of the element's header. */
	offset: number;
}

/** Reads one EBML variable-length integer. Returns null when the buffer is too short. */
export function readVint(
	buf: Uint8Array,
	pos: number,
	keepMarker: boolean
): { value: number; length: number; unknown: boolean } | null {
	if (pos >= buf.length) return null;
	const first = buf[pos];
	if (first === 0) return null;
	let length = 1;
	let mask = 0x80;
	while (!(first & mask)) {
		mask >>= 1;
		length++;
	}
	if (length > 8 || pos + length > buf.length) return null;
	let value = keepMarker ? first : first & (mask - 1);
	let allOnes = (first & (mask - 1)) === mask - 1;
	for (let i = 1; i < length; i++) {
		value = value * 256 + buf[pos + i];
		if (buf[pos + i] !== 0xff) allOnes = false;
	}
	return { value, length, unknown: !keepMarker && allOnes };
}

/** Reads an element header at `pos` of `buf`, whose first byte sits at file offset `base`. */
export function readElementHeader(buf: Uint8Array, pos: number, base = 0): EbmlElement | null {
	const id = readVint(buf, pos, true);
	if (!id) return null;
	const size = readVint(buf, pos + id.length, false);
	if (!size) return null;
	return {
		id: id.value,
		offset: base + pos,
		dataOffset: base + pos + id.length + size.length,
		size: size.unknown ? null : size.value
	};
}

function readUint(buf: Uint8Array, start: number, size: number): number {
	let value = 0;
	for (let i = 0; i < size; i++) value = value * 256 + buf[start + i];
	return value;
}

/** Iterates the children of an element held entirely in `buf[start, end)`. */
function* children(buf: Uint8Array, start: number, end: number): Generator<EbmlElement> {
	let pos = start;
	while (pos < end) {
		const el = readElementHeader(buf, pos);
		if (!el || el.size === null) return;
		if (el.dataOffset + el.size > end) return;
		yield el;
		pos = el.dataOffset + el.size;
	}
}

/** Parses a SeekHead body: element id -> position relative to the Segment data. */
export function parseSeekHead(buf: Uint8Array): Map<number, number[]> {
	const out = new Map<number, number[]>();
	for (const seek of children(buf, 0, buf.length)) {
		if (seek.id !== ID_SEEK || seek.size === null) continue;
		let target: number | null = null;
		let position: number | null = null;
		for (const field of children(buf, seek.dataOffset, seek.dataOffset + seek.size)) {
			if (field.id === ID_SEEK_ID && field.size !== null) {
				target = readVint(buf, field.dataOffset, true)?.value ?? null;
			} else if (field.id === ID_SEEK_POSITION && field.size !== null) {
				position = readUint(buf, field.dataOffset, field.size);
			}
		}
		if (target !== null && position !== null) {
			out.set(target, [...(out.get(target) ?? []), position]);
		}
	}
	return out;
}

/** Parses an Info body for TimestampScale (nanoseconds per tick, default 1,000,000). */
export function parseTimestampScale(buf: Uint8Array): number {
	for (const el of children(buf, 0, buf.length)) {
		if (el.id === ID_TIMESTAMP_SCALE && el.size !== null) {
			const scale = readUint(buf, el.dataOffset, el.size);
			if (scale > 0) return scale;
		}
	}
	return 1_000_000;
}

/** Parses a Tracks body and returns the first video track number. */
export function parseVideoTrackNumber(buf: Uint8Array): number | null {
	for (const entry of children(buf, 0, buf.length)) {
		if (entry.id !== ID_TRACK_ENTRY || entry.size === null) continue;
		let number: number | null = null;
		let type: number | null = null;
		for (const field of children(buf, entry.dataOffset, entry.dataOffset + entry.size)) {
			if (field.id === ID_TRACK_NUMBER && field.size !== null) {
				number = readUint(buf, field.dataOffset, field.size);
			} else if (field.id === ID_TRACK_TYPE && field.size !== null) {
				type = readUint(buf, field.dataOffset, field.size);
			}
		}
		if (type === 1 && number !== null) return number;
	}
	return null;
}

/** Parses a Cues body: sorted unique cue times (in ticks) for one track. */
export function parseCueTimes(buf: Uint8Array, track: number): number[] {
	const times = new Set<number>();
	for (const point of children(buf, 0, buf.length)) {
		if (point.id !== ID_CUE_POINT || point.size === null) continue;
		let time: number | null = null;
		let forTrack = false;
		for (const field of children(buf, point.dataOffset, point.dataOffset + point.size)) {
			if (field.id === ID_CUE_TIME && field.size !== null) {
				time = readUint(buf, field.dataOffset, field.size);
			} else if (field.id === ID_CUE_TRACK_POSITIONS && field.size !== null) {
				for (const pos of children(buf, field.dataOffset, field.dataOffset + field.size)) {
					if (
						pos.id === ID_CUE_TRACK &&
						pos.size !== null &&
						readUint(buf, pos.dataOffset, pos.size) === track
					) {
						forTrack = true;
					}
				}
			}
		}
		if (time !== null && forTrack) times.add(time);
	}
	return [...times].sort((a, b) => a - b);
}

async function readAt(handle: FileHandle, offset: number, length: number): Promise<Uint8Array> {
	const buf = new Uint8Array(length);
	const { bytesRead } = await handle.read(buf, 0, length, offset);
	return buf.subarray(0, bytesRead);
}

async function readElementAt(
	handle: FileHandle,
	offset: number,
	expectedId: number
): Promise<Uint8Array | null> {
	const head = await readAt(handle, offset, 16);
	const el = readElementHeader(head, 0, offset);
	if (!el || el.id !== expectedId || el.size === null || el.size > MAX_ELEMENT_BYTES) return null;
	return readAt(handle, el.dataOffset, el.size);
}

/**
 * Returns the video keyframe times (seconds, ascending) listed in the file's Cues, or null when the
 * file is not Matroska/WebM or has no usable Cues (the caller then falls back to ffprobe).
 */
export async function readMkvCueKeyframes(path: string): Promise<number[] | null> {
	const handle = await open(path, 'r');
	try {
		const head = await readAt(handle, 0, HEAD_BYTES);
		const ebml = readElementHeader(head, 0);
		if (!ebml || ebml.id !== ID_EBML || ebml.size === null) return null;
		const segment = readElementHeader(head, ebml.dataOffset + ebml.size);
		if (!segment || segment.id !== ID_SEGMENT) return null;
		const segmentData = segment.dataOffset;

		// Top-level elements present in the first chunk (stop at the first Cluster).
		const found = new Map<number, Uint8Array>();
		const seekPositions = new Map<number, number[]>();
		let pos = segmentData;
		while (pos < head.length) {
			const el = readElementHeader(head, pos);
			if (!el || el.size === null || el.id === ID_CLUSTER) break;
			if (el.dataOffset + el.size <= head.length) {
				const body = head.subarray(el.dataOffset, el.dataOffset + el.size);
				if (el.id === ID_SEEKHEAD) {
					for (const [id, list] of parseSeekHead(body)) {
						seekPositions.set(id, [...(seekPositions.get(id) ?? []), ...list]);
					}
				} else if (!found.has(el.id)) {
					found.set(el.id, body);
				}
			}
			pos = el.dataOffset + el.size;
		}

		// A SeekHead may point to a second SeekHead (typically at the end of the file).
		for (const position of seekPositions.get(ID_SEEKHEAD) ?? []) {
			const body = await readElementAt(handle, segmentData + position, ID_SEEKHEAD);
			if (!body) continue;
			for (const [id, list] of parseSeekHead(body)) {
				seekPositions.set(id, [...(seekPositions.get(id) ?? []), ...list]);
			}
		}

		const load = async (id: number): Promise<Uint8Array | null> => {
			if (found.has(id)) return found.get(id)!;
			for (const position of seekPositions.get(id) ?? []) {
				const body = await readElementAt(handle, segmentData + position, id);
				if (body) return body;
			}
			return null;
		};

		const tracks = await load(ID_TRACKS);
		const cues = await load(ID_CUES);
		if (!tracks || !cues) return null;
		const info = await load(ID_INFO);
		const scale = info ? parseTimestampScale(info) : 1_000_000;
		const videoTrack = parseVideoTrackNumber(tracks);
		if (videoTrack === null) return null;
		const ticks = parseCueTimes(cues, videoTrack);
		if (ticks.length === 0) return null;
		// Round to the microsecond so the strings match ffprobe's pts_time.
		return ticks.map((t) => Math.round((t * scale) / 1000) / 1_000_000);
	} finally {
		await handle.close();
	}
}
