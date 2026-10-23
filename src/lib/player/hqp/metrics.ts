// Playback info ("stats for nerds", spec 7.3): read on demand at 1 Hz while the panel is open.
// Values the contract does not carry are null (the UI shows a dash). Never a file path.
import type { PlaybackSession } from '$lib/media/types';
import type { TransportStats } from './transport';
import type {
	Delivery,
	HqpAudioOption,
	HqpItem,
	HqpMetrics,
	HqpSubtitleState,
	QualityChoice
} from './types';
import type { QualityLevel } from '$lib/media/types';

export function bufferedRanges(video: HTMLVideoElement | null): Array<[number, number]> {
	const out: Array<[number, number]> = [];
	const ranges = video?.buffered;
	if (!ranges) return out;
	for (let i = 0; i < ranges.length; i++) out.push([ranges.start(i), ranges.end(i)]);
	return out;
}

/** End of the buffered range holding `position` (the position itself when none does). */
export function bufferedEndAt(ranges: Array<[number, number]>, position: number): number {
	const hit = ranges.find(([start, end]) => position >= start - 0.1 && position <= end);
	return hit ? hit[1] : position;
}

export function bufferAhead(ranges: Array<[number, number]>, position: number): number {
	return Math.max(0, bufferedEndAt(ranges, position) - position);
}

/** Median frame interval over 30 animation frames, as a rate in Hz (null without rAF). */
export function estimateRefreshRate(
	raf: ((callback: FrameRequestCallback) => number) | null | undefined,
	samples = 30
): Promise<number | null> {
	if (!raf) return Promise.resolve(null);
	return new Promise((resolve) => {
		const times: number[] = [];
		const step = (t: number) => {
			times.push(t);
			if (times.length <= samples) return void raf(step);
			const deltas = times
				.slice(1)
				.map((x, i) => x - times[i])
				.sort((a, b) => a - b);
			const median = deltas[Math.floor(deltas.length / 2)];
			resolve(median > 0 ? Math.round(1000 / median) : null);
		};
		raf(step);
	});
}

type LooseVideo = PlaybackSession['video'] & {
	profile?: string | null;
	frameRate?: number | null;
	bitDepth?: number | null;
	bitRate?: number | null;
};

export interface MetricsInput {
	video: HTMLVideoElement | null;
	session: PlaybackSession | null;
	delivery: Delivery | null;
	item: HqpItem | null;
	hdrShown: boolean;
	audio: HqpAudioOption[];
	subtitles: HqpSubtitleState;
	stats: TransportStats | null;
	quality: { choice: QualityChoice; active: QualityLevel | null };
	screen: HqpMetrics['screen'];
}

export function buildMetrics(input: MetricsInput): HqpMetrics {
	const { session, video } = input;
	const v = (session?.video ?? null) as LooseVideo | null;
	const audio = input.audio.find((a) => a.selected) ?? null;
	const shown = input.subtitles.selected ?? input.subtitles.forced;
	const sub = input.subtitles.options.find((o) => o.ordinal === shown) ?? null;
	const quality = video?.getVideoPlaybackQuality?.();
	const depth = v?.bitDepth === 8 || v?.bitDepth === 10 ? v.bitDepth : v?.hdr ? 10 : null;
	return {
		sessionId: session?.sessionId ?? null,
		delivery: input.delivery,
		videoMode: v?.mode ?? null,
		reason: v?.reason ?? null,
		codec: v?.codec ?? null,
		profile: v?.profile ?? null,
		width: v?.width ?? null,
		height: v?.height ?? null,
		frameRate: v?.frameRate ?? null,
		bitDepth: depth,
		hdr: input.item?.file.hdr ?? 'sdr',
		hdrShown: input.hdrShown,
		audio: {
			label: audio?.label ?? null,
			codec: audio?.codec ?? null,
			channels: audio?.channels ?? null,
			mode: session?.audioMode ?? null
		},
		subtitles: sub ? `WebVTT · ${sub.label}${sub.forced ? ' forced' : ''}` : null,
		segmentSeconds: session?.segmentSeconds ?? null,
		bitrate: { measured: input.stats?.bitrate ?? null, file: v?.bitRate ?? null },
		throughput: input.stats?.throughput ?? null,
		bufferAhead: video ? bufferAhead(bufferedRanges(video), video.currentTime) : 0,
		frames: quality
			? { dropped: quality.droppedVideoFrames, total: quality.totalVideoFrames }
			: null,
		screen: input.screen,
		quality: input.quality
	};
}
