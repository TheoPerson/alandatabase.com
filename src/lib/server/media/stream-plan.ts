// Chooses how one file is streamed to one client: the untouched original video (direct stream)
// whenever the client decodes it, otherwise a GPU transcode that keeps as much of the picture as
// the client can show (10-bit and HDR kept on HEVC Main 10, tone-mapped to SDR only for 8-bit
// output). Audio is copied when the client decodes it (Dolby on Apple devices), else AAC.

import type {
	AudioTrack,
	ClientCaps,
	HdrKind,
	MediaFileRecord,
	QualityLevel,
	VideoInfo
} from '$lib/media/types';

export interface EncoderSupport {
	nvenc: boolean; // h264_nvenc + hevc_nvenc usable
	cuda: boolean; // CUDA decode + scale_cuda usable
	libplacebo: boolean; // Vulkan libplacebo usable (GPU tone mapping)
}

export type Transfer = 'sdr' | 'pq' | 'hlg';

export interface VideoPlan {
	mode: 'copy' | 'transcode';
	codec: 'h264' | 'hevc' | 'av1';
	encoder: 'copy' | 'hevc_nvenc' | 'h264_nvenc' | 'libx264';
	width: number;
	height: number;
	tenBit: boolean;
	transfer: Transfer; // output transfer
	toneMap: 'none' | 'libplacebo' | 'zscale'; // HDR -> SDR conversion
	doviReshape: boolean; // Dolby Vision profile 5 converted to HDR10 by libplacebo
	maxBitrate: number | null; // bits/s cap for transcodes
	cq: number | null;
	reason: string;
}

export interface AudioPlan {
	ordinal: number;
	mode: 'copy' | 'transcode';
	codec: string; // output codec: source codec when copied, else aac
	channels: number;
	bitrate: number | null;
}

export interface StreamPlan {
	quality: QualityLevel;
	video: VideoPlan;
	audio: AudioPlan | null;
	segments: 'keyframes' | 'uniform';
}

export const QUALITY_BOXES: Record<Exclude<QualityLevel, 'original'>, [number, number]> = {
	'2160p': [3840, 2160],
	'1080p': [1920, 1080],
	'720p': [1280, 720],
	'480p': [854, 480]
};

const LEVEL_ORDER: Exclude<QualityLevel, 'original'>[] = ['2160p', '1080p', '720p', '480p'];

// Bitrate caps (bits/s). 'original' transcodes aim at the best picture at the source size; lower
// levels exist for slow networks and are capped harder.
const ORIGINAL_CAPS = { hevc: [40e6, 16e6, 8e6, 4e6], h264: [50e6, 20e6, 10e6, 5e6] };
const LEVEL_CAPS = { hevc: [25e6, 8e6, 4e6, 1.5e6], h264: [32e6, 10e6, 5e6, 2e6] };

// Class of a picture by its 16:9-equivalent height, so 1920x800 scope counts as 1080p.
function capIndex(width: number, height: number): number {
	height = Math.max(height, Math.round((width * 9) / 16));
	if (height > 1200) return 0;
	if (height > 800) return 1;
	if (height > 540) return 2;
	return 3;
}

export function isTenBit(video: VideoInfo): boolean {
	return /10|12/u.test(video.pixFmt ?? '') || /main ?10|main 12/iu.test(video.profile ?? '');
}

/** What the source shows on a display without Dolby Vision. */
export function sourceTransfer(video: VideoInfo): Transfer | 'dovi-only' {
	const hdr: HdrKind = video.hdr;
	if (hdr === 'hdr10') return 'pq';
	if (hdr === 'hlg') return 'hlg';
	if (hdr === 'dolby-vision') {
		if (video.dvFallback === null) return 'dovi-only'; // profile 5: no compatible base layer
		if (video.dvFallback === 'hlg') return 'hlg';
		if (video.dvFallback === 'sdr') return 'sdr';
		return 'pq'; // profile 8.1 / 7 (HDR10 base) or unknown: the base layer is HDR10
	}
	return 'sdr';
}

function codecName(codec: string): 'h264' | 'hevc' | 'av1' | null {
	if (codec === 'h264') return 'h264';
	if (codec === 'hevc') return 'hevc';
	if (codec === 'av1') return 'av1';
	return null;
}

/** Whether the client decodes the source video bitstream as is. */
export function clientDecodes(video: VideoInfo, caps: ClientCaps): boolean {
	// Browsers and Apple devices decode 4:2:0 only (no 4:2:2 / 4:4:4 professional profiles).
	if (video.pixFmt && /(422|444)/u.test(video.pixFmt)) return false;
	const codec = codecName(video.codec);
	if (codec === 'h264') return caps.h264 !== false && !isTenBit(video);
	if (codec === 'hevc') return isTenBit(video) ? caps.hevcMain10 : caps.hevc;
	if (codec === 'av1') return caps.av1;
	return false;
}

function even(value: number): number {
	return Math.max(2, Math.round(value / 2) * 2);
}

/** Output size fitting the source into a box (never upscaled). */
export function fitInto(
	width: number,
	height: number,
	box: [number, number] | null
): [number, number] {
	if (!box || (width <= box[0] && height <= box[1])) return [width, height];
	const scale = Math.min(box[0] / width, box[1] / height);
	return [even(width * scale), even(height * scale)];
}

function clientBox(caps: ClientCaps): [number, number] | null {
	if (!caps.maxHeight || caps.maxHeight <= 0) return null;
	return [Math.round((caps.maxHeight * 16) / 9), caps.maxHeight];
}

function smallerBox(a: [number, number] | null, b: [number, number] | null) {
	if (!a) return b;
	if (!b) return a;
	return a[1] <= b[1] ? a : b;
}

/** Quality levels worth offering: 'original' plus every level below the source size. */
export function availableQualities(file: MediaFileRecord, caps: ClientCaps): QualityLevel[] {
	const video = file.video;
	if (!video) return ['original'];
	const box = clientBox(caps);
	const levels = LEVEL_ORDER.filter((level) => {
		const [w, h] = QUALITY_BOXES[level];
		const fitsSource = video.width > w || video.height > h;
		const fitsClient = !box || h <= box[1];
		return fitsSource && fitsClient;
	});
	return ['original', ...levels];
}

const FRENCH = new Set(['fre', 'fra', 'fr']);

/** Default audio: first French track, else the default-flagged one, else the first. */
export function pickDefaultAudio(tracks: AudioTrack[]): AudioTrack | null {
	if (tracks.length === 0) return null;
	return (
		tracks.find((t) => FRENCH.has((t.language ?? '').toLowerCase())) ??
		tracks.find((t) => t.isDefault) ??
		tracks[0]
	);
}

export function planAudio(
	tracks: AudioTrack[],
	requested: number | null,
	caps: ClientCaps
): AudioPlan | null {
	const track =
		(requested !== null ? tracks.find((t) => t.ordinal === requested) : undefined) ??
		pickDefaultAudio(tracks);
	if (!track) return null;
	const channels = track.channels ?? 2;
	const codec = track.codec;
	const copy =
		(codec === 'aac' && channels <= 6) ||
		(codec === 'eac3' && caps.eac3 === true) ||
		(codec === 'ac3' && caps.ac3 === true);
	if (copy) return { ordinal: track.ordinal, mode: 'copy', codec, channels, bitrate: null };
	const surround = caps.multichannel === true && channels >= 6;
	return {
		ordinal: track.ordinal,
		mode: 'transcode',
		codec: 'aac',
		channels: surround ? 6 : 2,
		bitrate: surround ? 384_000 : 192_000
	};
}

const CODEC_LABEL: Record<string, string> = { h264: 'H.264', hevc: 'HEVC', av1: 'AV1' };

function describeSource(video: VideoInfo): string {
	const depth = isTenBit(video) ? ' 10-bit' : '';
	const hdr =
		video.hdr === 'sdr'
			? ''
			: ` ${video.hdr === 'dolby-vision' ? 'Dolby Vision' : video.hdr.toUpperCase()}`;
	return `${CODEC_LABEL[video.codec] ?? video.codec.toUpperCase()}${depth}${hdr}, ${video.width}×${video.height}`;
}

export interface PlanInput {
	file: MediaFileRecord;
	caps: ClientCaps;
	quality: QualityLevel;
	audio: number | null;
	hasKeyframeIndex: boolean;
	encoders: EncoderSupport;
}

export function chooseStreamPlan(input: PlanInput): StreamPlan {
	const { file, caps, encoders } = input;
	const video = file.video;
	if (!video) throw new Error('File has no video stream');
	const quality: QualityLevel = input.quality ?? 'original';
	const audio = planAudio(file.audioTracks, input.audio, caps);
	const transfer = sourceTransfer(video);
	const decodes = clientDecodes(video, caps);
	const levelBox = quality === 'original' ? null : QUALITY_BOXES[quality];
	const box = smallerBox(levelBox, clientBox(caps));
	const [width, height] = fitInto(video.width, video.height, box);
	const resized = width !== video.width || height !== video.height;
	const sourceCodec = codecName(video.codec);

	if (
		quality === 'original' &&
		decodes &&
		sourceCodec &&
		!resized &&
		transfer !== 'dovi-only' &&
		input.hasKeyframeIndex
	) {
		return {
			quality,
			audio,
			segments: 'keyframes',
			video: {
				mode: 'copy',
				codec: sourceCodec,
				encoder: 'copy',
				width: video.width,
				height: video.height,
				tenBit: isTenBit(video),
				transfer,
				toneMap: 'none',
				doviReshape: false,
				maxBitrate: null,
				cq: null,
				reason: `Original stream (${describeSource(video)})`
			}
		};
	}

	// Transcode. Pick the best output the client decodes.
	const sourceHdr = transfer !== 'sdr';
	const wantsTenBit = isTenBit(video) || sourceHdr;
	let codec: 'hevc' | 'h264';
	let tenBit: boolean;
	if (encoders.nvenc && caps.hevcMain10 && wantsTenBit) {
		codec = 'hevc';
		tenBit = true;
	} else if (encoders.nvenc && (caps.hevc || caps.hevcMain10)) {
		codec = 'hevc';
		tenBit = false;
	} else {
		codec = 'h264';
		tenBit = false;
	}
	const encoder = codec === 'hevc' ? 'hevc_nvenc' : encoders.nvenc ? 'h264_nvenc' : 'libx264';

	// Without NVENC the CPU encoder cannot keep up above 1080p.
	let outWidth = width;
	let outHeight = height;
	if (!encoders.nvenc) [outWidth, outHeight] = fitInto(width, height, QUALITY_BOXES['1080p']);

	let outTransfer: Transfer = 'sdr';
	let toneMap: VideoPlan['toneMap'] = 'none';
	let doviReshape = false;
	if (tenBit && transfer === 'dovi-only' && !(encoders.libplacebo && encoders.cuda)) {
		tenBit = false; // no Dolby Vision reshaping available: tone-map to 8-bit SDR instead
	}
	if (tenBit && sourceHdr) {
		if (transfer === 'dovi-only') {
			doviReshape = true;
			outTransfer = 'pq';
		} else {
			outTransfer = transfer;
		}
	} else if (sourceHdr) {
		toneMap = encoders.libplacebo && encoders.cuda ? 'libplacebo' : 'zscale';
	}

	const capTable = quality === 'original' ? ORIGINAL_CAPS : LEVEL_CAPS;
	const maxBitrate = capTable[codec][capIndex(outWidth, outHeight)];
	const cq = quality === 'original' ? 19 : 23;

	const why: string[] = [];
	if (!decodes)
		why.push(
			`${CODEC_LABEL[video.codec] ?? video.codec.toUpperCase()}${isTenBit(video) ? ' 10-bit' : ''} is not supported on this device`
		);
	else if (transfer === 'dovi-only') why.push('Dolby Vision profile 5 needs conversion');
	else if (quality !== 'original') why.push(`${quality} for a lighter stream`);
	else if (resized) why.push(`limited to ${outHeight}p on this device`);
	else if (!input.hasKeyframeIndex) why.push('first play, the original stream is being prepared');
	if (toneMap !== 'none') why.push('HDR mapped to SDR');
	const where = encoders.nvenc ? 'on the GPU' : 'on the CPU';

	return {
		quality,
		audio,
		segments: 'uniform',
		video: {
			mode: 'transcode',
			codec,
			encoder,
			width: outWidth,
			height: outHeight,
			tenBit,
			transfer: outTransfer,
			toneMap,
			doviReshape,
			maxBitrate,
			cq,
			reason: `Converted ${where}${why.length ? `: ${why.join(', ')}` : ''}`
		}
	};
}
