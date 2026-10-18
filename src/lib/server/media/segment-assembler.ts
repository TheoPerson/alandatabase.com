// Turns one ffmpeg run's fragmented-MP4 stdout into numbered HLS segments.
//
// ffmpeg starts a fragment at every video keyframe (+frag_keyframe), and every segment boundary is
// a keyframe (direct stream: from the keyframe index; transcode: forced every 4 s), so a segment is
// exactly the run of fragments whose first video sample lies in [boundary k, boundary k+1).
// Fragments before the run's first segment (ffmpeg's seek lands up to one GOP early) are dropped.

import { Fmp4Splitter, parseInitTracks, setFragmentSequence, type Fragment } from './fmp4';
import { segmentAt } from './keyframes';

export interface AssembledSegment {
	index: number;
	bytes: Uint8Array;
	/** First video sample presentation time (source seconds) and end of the last one. */
	start: number;
	end: number;
}

export interface AssemblerOptions {
	boundaries: number[]; // segment start times, source seconds
	startIndex: number; // first segment this run is expected to produce
	offset: number; // seconds added to every timestamp by ffmpeg (-output_ts_offset)
	onInit: (init: Uint8Array) => void;
	onSegment: (segment: AssembledSegment) => void;
	/** Segments this run skipped (no keyframe at their boundary) or never reached. */
	onMissing?: (from: number, to: number) => void;
}

// Presentation times are compared with a small tolerance (timescale rounding).
const TOLERANCE = 0.002;

export class SegmentAssembler {
	private readonly splitter: Fmp4Splitter;
	private videoTrack: { id: number; timescale: number } | null = null;
	private current = -1;
	private parts: Uint8Array[] = [];
	private start = 0;
	private end = 0;
	private ended = false;

	constructor(private readonly options: AssemblerOptions) {
		this.splitter = new Fmp4Splitter(
			(init) => {
				const video = parseInitTracks(init).find((t) => t.kind === 'video');
				this.videoTrack = video ? { id: video.id, timescale: video.timescale } : null;
				options.onInit(init);
			},
			(fragment) => this.onFragment(fragment)
		);
	}

	/** Segment currently being assembled (the next one to complete). */
	get next(): number {
		return this.current < 0 ? this.options.startIndex : this.current;
	}

	push(chunk: Uint8Array): void {
		if (!this.ended) this.splitter.push(chunk);
	}

	/** ffmpeg reached the end of the file: the segment in progress is complete. */
	finish(): void {
		if (this.ended) return;
		this.ended = true;
		const last = this.options.boundaries.length - 1;
		if (this.current >= this.options.startIndex && this.parts.length) this.flush();
		const reached = Math.max(this.current, this.options.startIndex - 1);
		if (reached < last) this.options.onMissing?.(reached + 1, last);
	}

	private onFragment(fragment: Fragment): void {
		const video = this.videoTrack
			? fragment.trafs.find((t) => t.trackId === this.videoTrack!.id)
			: undefined;
		if (video && this.videoTrack) {
			const scale = this.videoTrack.timescale;
			const pts =
				(video.baseDecodeTime + video.firstCompositionOffset) / scale - this.options.offset;
			const end = (video.baseDecodeTime + video.duration) / scale - this.options.offset;
			const index = segmentAt(this.options.boundaries, pts + TOLERANCE);
			if (index < this.options.startIndex) return; // pre-roll before the requested segment
			if (index !== this.current) {
				if (this.current >= 0 && index > this.current) {
					this.flush();
					if (index > this.current + 1) this.options.onMissing?.(this.current + 1, index - 1);
				} else if (this.current < 0 && index > this.options.startIndex) {
					this.options.onMissing?.(this.options.startIndex, index - 1);
				}
				if (index > this.current) {
					this.current = index;
					this.start = pts;
					this.end = end;
				}
			}
			this.end = Math.max(this.end, end);
		}
		if (this.current < 0) return; // audio before the first video fragment of the run
		const bytes = fragment.bytes;
		setFragmentSequence(bytes, this.current * 1000 + this.parts.length + 1);
		this.parts.push(bytes);
	}

	private flush(): void {
		const total = this.parts.reduce((n, p) => n + p.length, 0);
		const bytes = new Uint8Array(total);
		let offset = 0;
		for (const part of this.parts) {
			bytes.set(part, offset);
			offset += part.length;
		}
		this.parts = [];
		this.options.onSegment({ index: this.current, bytes, start: this.start, end: this.end });
	}
}
