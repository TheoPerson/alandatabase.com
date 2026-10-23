// ffmpeg command lines for a streaming run. Every run writes one fragmented MP4 to stdout
// (init segment, then one moof+mdat per video keyframe); the session splits it into HLS segments.
//
// Timeline: -copyts keeps source timestamps, +frag_discont writes them into each fragment's
// tfdt, and a constant +1 s offset keeps decode times of leading B-frames non-negative. Edit lists
// are disabled so every run of a session writes a byte-identical init segment (verified).

import type { StreamPlan, VideoPlan } from './stream-plan';
import { UNIFORM_SEGMENT_SECONDS } from './keyframes';

/** Constant offset (seconds) added to every output timestamp. */
export const TIMELINE_OFFSET = 1;

export interface RunInput {
	inputPath: string;
	startSeconds: number;
	plan: StreamPlan;
}

function seconds(value: number): string {
	return (Math.round(value * 1000) / 1000).toFixed(3);
}

function colorArgs(video: VideoPlan): string[] {
	if (video.transfer === 'pq') {
		return ['-color_primaries', 'bt2020', '-color_trc', 'smpte2084', '-colorspace', 'bt2020nc'];
	}
	if (video.transfer === 'hlg') {
		return ['-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc'];
	}
	if (video.toneMap !== 'none') {
		return ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];
	}
	return [];
}

const ZSCALE_TONEMAP =
	'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv';

/** Video filter graph (null when the frames go to the encoder untouched). */
export function videoFilter(video: VideoPlan, gpu: boolean): string | null {
	const { width, height } = video;
	if (gpu) {
		const scale = (format: string) =>
			`scale_cuda=w=${width}:h=${height}:interp_algo=lanczos:format=${format}`;
		if (video.doviReshape) {
			return [
				scale('p010le'),
				'hwdownload',
				'format=p010le',
				'hwupload',
				'libplacebo=colorspace=bt2020nc:color_primaries=bt2020:color_trc=smpte2084:range=tv:format=p010le',
				'hwdownload',
				'format=p010le'
			].join(',');
		}
		if (video.toneMap === 'libplacebo') {
			return [
				scale('p010le'),
				'hwdownload',
				'format=p010le',
				'hwupload',
				'libplacebo=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv:tonemapping=bt.2390:format=nv12',
				'hwdownload',
				'format=nv12'
			].join(',');
		}
		if (video.toneMap === 'zscale') {
			return [scale('p010le'), 'hwdownload', 'format=p010le', ZSCALE_TONEMAP, 'format=nv12'].join(
				','
			);
		}
		return scale(video.tenBit ? 'p010le' : 'nv12');
	}
	const parts = [`scale=w=${width}:h=${height}:flags=lanczos`];
	if (video.toneMap !== 'none') parts.push('format=yuv420p10le', ZSCALE_TONEMAP);
	parts.push(`format=${video.tenBit ? 'yuv420p10le' : 'yuv420p'}`);
	return parts.join(',');
}

function encoderArgs(video: VideoPlan): string[] {
	const cap = video.maxBitrate ?? 20e6;
	const rate = (bits: number) => `${Math.round(bits / 1000)}k`;
	const gop = [
		'-g',
		'1000',
		'-force_key_frames',
		`expr:gte(t,n_forced*${UNIFORM_SEGMENT_SECONDS})`
	];
	if (video.encoder === 'libx264') {
		return [
			'-c:v',
			'libx264',
			'-preset',
			'veryfast',
			'-crf',
			String(video.cq ?? 20),
			'-maxrate',
			rate(cap),
			'-bufsize',
			rate(cap * 2),
			'-profile:v',
			'high',
			'-sc_threshold',
			'0',
			...gop
		];
	}
	// Measured on the RTX 4060 (4K AV1 HDR -> 4K HEVC Main 10, CQ 19): p5 + 20-frame lookahead
	// runs at 3.8x real time, p4 + 8-frame lookahead at 5.8x for the same bitrate (same quality),
	// p3 at 8.7x but +45 % bitrate. Above 1080p use p4 so seeks stay quick; p5 otherwise (16-20x).
	const large = Math.max(video.height, (video.width * 9) / 16) > 1200;
	const nvenc = [
		'-preset',
		large ? 'p4' : 'p5',
		'-tune',
		'hq',
		'-rc',
		'vbr',
		'-cq',
		String(video.cq ?? 20),
		'-b:v',
		'0',
		'-maxrate',
		rate(cap),
		'-bufsize',
		rate(cap * 2),
		'-spatial-aq',
		'1',
		'-temporal-aq',
		'1',
		'-rc-lookahead',
		large ? '8' : '20',
		'-bf',
		'3',
		'-no-scenecut',
		'1',
		'-forced-idr',
		'1',
		...gop
	];
	if (video.encoder === 'hevc_nvenc') {
		return [
			'-c:v',
			'hevc_nvenc',
			'-profile:v',
			video.tenBit ? 'main10' : 'main',
			...nvenc,
			'-b_ref_mode',
			'middle',
			'-tag:v',
			'hvc1'
		];
	}
	return ['-c:v', 'h264_nvenc', '-profile:v', 'high', ...nvenc];
}

/** Full argument list (without the ffmpeg executable) for a run starting at `startSeconds`. */
export function buildStreamArgs(input: RunInput): string[] {
	const { plan } = input;
	const video = plan.video;
	const gpu = video.mode === 'transcode' && video.encoder !== 'libx264';
	const needsVulkan = gpu && (video.toneMap === 'libplacebo' || video.doviReshape);
	const args = ['-hide_banner', '-nostdin', '-loglevel', 'error'];
	if (needsVulkan) args.push('-init_hw_device', 'vulkan=vk', '-filter_hw_device', 'vk');
	if (gpu) args.push('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda');
	args.push('-copyts');
	if (input.startSeconds > 0) args.push('-ss', seconds(input.startSeconds));
	args.push('-i', input.inputPath, '-map', '0:v:0');
	if (plan.audio) args.push('-map', `0:a:${plan.audio.ordinal}`);
	args.push('-map_chapters', '-1', '-map_metadata', '-1');

	if (video.mode === 'copy') {
		args.push('-c:v', 'copy');
		if (video.codec === 'hevc') args.push('-tag:v', 'hvc1');
	} else {
		const filter = videoFilter(video, gpu);
		if (filter) args.push('-vf', filter);
		args.push(...encoderArgs(video), ...colorArgs(video));
	}

	if (plan.audio) {
		if (plan.audio.mode === 'copy') {
			args.push('-c:a', 'copy');
		} else {
			args.push(
				'-c:a',
				'aac',
				'-b:a',
				`${Math.round((plan.audio.bitrate ?? 192_000) / 1000)}k`,
				'-ac',
				String(plan.audio.channels),
				'-af',
				'aresample=async=1'
			);
		}
	}

	// Copied AC-3 / E-AC-3 needs its first packets parsed before the moov (dec3/dac3 boxes,
	// Atmos flag): delay_moov writes the init segment with the first fragment. Verified to stay
	// byte-identical across runs.
	const dolbyCopy =
		plan.audio?.mode === 'copy' && (plan.audio.codec === 'eac3' || plan.audio.codec === 'ac3');
	args.push(
		'-max_muxing_queue_size',
		'4096',
		'-f',
		'mp4',
		'-movflags',
		`+frag_keyframe+empty_moov${dolbyCopy ? '+delay_moov' : ''}+default_base_moof+frag_discont`,
		'-use_editlist',
		'0',
		'-output_ts_offset',
		String(TIMELINE_OFFSET),
		'-avoid_negative_ts',
		'disabled',
		'pipe:1'
	);
	return args;
}
