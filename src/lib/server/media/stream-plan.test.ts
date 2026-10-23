import { describe, expect, it } from 'vitest';
import type { AudioTrack, ClientCaps, MediaFileRecord, VideoInfo } from '$lib/media/types';
import { buildStreamArgs, TIMELINE_OFFSET, videoFilter } from './ffmpeg-args';
import {
	availableQualities,
	chooseStreamPlan,
	clientDecodes,
	fitInto,
	pickDefaultAudio,
	planAudio,
	type EncoderSupport
} from './stream-plan';

const GPU: EncoderSupport = { nvenc: true, cuda: true, libplacebo: true };
const GPU_NO_VULKAN: EncoderSupport = { nvenc: true, cuda: true, libplacebo: false };
const CPU: EncoderSupport = { nvenc: false, cuda: false, libplacebo: false };

const CHROME: ClientCaps = {
	h264: true,
	hevc: true,
	hevcMain10: true,
	av1: true,
	nativeHls: false,
	maxHeight: null,
	ac3: false,
	eac3: false,
	hdrDisplay: false,
	multichannel: false
};
const IPHONE: ClientCaps = {
	h264: true,
	hevc: true,
	hevcMain10: true,
	av1: true,
	nativeHls: true,
	maxHeight: null,
	ac3: true,
	eac3: true,
	hdrDisplay: true,
	multichannel: true
};
const H264_ONLY: ClientCaps = {
	h264: true,
	hevc: false,
	hevcMain10: false,
	av1: false,
	nativeHls: false,
	maxHeight: null
};

function audio(partial: Partial<AudioTrack> & { ordinal: number }): AudioTrack {
	return {
		codec: 'eac3',
		channels: 6,
		language: 'fre',
		title: null,
		isDefault: false,
		...partial
	};
}

function file(video: Partial<VideoInfo>, audioTracks: AudioTrack[] = [audio({ ordinal: 0 })]) {
	return {
		id: '11111111-1111-4111-8111-111111111111',
		path: 'F:/MOVIES/x.mkv',
		sizeBytes: 1,
		durationSeconds: 6000,
		video: {
			codec: 'hevc',
			profile: 'Main 10',
			pixFmt: 'yuv420p10le',
			width: 3840,
			height: 1600,
			hdr: 'hdr10',
			...video
		},
		audioTracks,
		subtitleTracks: [],
		movieId: null,
		episodeId: null,
		matchStatus: 'matched'
	} satisfies MediaFileRecord;
}

const HEVC_HDR_4K = file({});
const HEVC_10_SDR_1080 = file({ width: 1920, height: 816, hdr: 'sdr' });
const HEVC_8_1080 = file({
	profile: 'Main',
	pixFmt: 'yuv420p',
	width: 1920,
	height: 1080,
	hdr: 'sdr'
});
const AV1_HDR_4K = file({ codec: 'av1', profile: 'Main', width: 3840, height: 1746 });
const H264_1080 = file(
	{ codec: 'h264', profile: 'High', pixFmt: 'yuv420p', width: 1920, height: 1080, hdr: 'sdr' },
	[audio({ ordinal: 0, codec: 'eac3' }), audio({ ordinal: 1, codec: 'aac', channels: 2 })]
);
const DV5 = file({ hdr: 'dolby-vision', dvProfile: 5, dvFallback: null });
const DV8 = file({ hdr: 'dolby-vision', dvProfile: 8, dvFallback: 'hdr10' });
const HLG = file({ hdr: 'hlg', width: 1920, height: 1080 });

function plan(
	f: MediaFileRecord,
	caps: ClientCaps,
	opts: Partial<Parameters<typeof chooseStreamPlan>[0]> = {}
) {
	return chooseStreamPlan({
		file: f,
		caps,
		quality: 'original',
		audio: null,
		hasKeyframeIndex: true,
		encoders: GPU,
		...opts
	});
}

function argValue(args: string[], flag: string): string | undefined {
	const i = args.indexOf(flag);
	return i >= 0 ? args[i + 1] : undefined;
}

describe('clientDecodes', () => {
	it('matches codec, profile and bit depth against the client caps', () => {
		expect(clientDecodes(HEVC_HDR_4K.video, CHROME)).toBe(true);
		expect(clientDecodes(HEVC_HDR_4K.video, { ...CHROME, hevcMain10: false })).toBe(false);
		expect(clientDecodes(HEVC_8_1080.video, { ...CHROME, hevcMain10: false })).toBe(true);
		expect(clientDecodes(AV1_HDR_4K.video, CHROME)).toBe(true);
		expect(clientDecodes(AV1_HDR_4K.video, { ...CHROME, av1: false })).toBe(false);
		expect(clientDecodes(H264_1080.video, H264_ONLY)).toBe(true);
		expect(clientDecodes({ ...H264_1080.video, pixFmt: 'yuv420p10le' }, CHROME)).toBe(false);
		expect(clientDecodes({ ...H264_1080.video, codec: 'mpeg4' }, CHROME)).toBe(false);
		expect(clientDecodes({ ...HEVC_HDR_4K.video, pixFmt: 'yuv422p10le' }, CHROME)).toBe(false);
	});
});

describe('direct stream (copy)', () => {
	it('copies HEVC Main 10 HDR10 untouched at the source size, tagged hvc1', () => {
		const p = plan(HEVC_HDR_4K, CHROME);
		expect(p.video).toMatchObject({
			mode: 'copy',
			codec: 'hevc',
			width: 3840,
			height: 1600,
			tenBit: true,
			transfer: 'pq'
		});
		expect(p.video.reason).toBe('Original stream (HEVC 10-bit HDR10, 3840×1600)');
		expect(p.segments).toBe('keyframes');
		const args = buildStreamArgs({ inputPath: 'F:/MOVIES/x.mkv', startSeconds: 359.792, plan: p });
		expect(argValue(args, '-c:v')).toBe('copy');
		expect(argValue(args, '-tag:v')).toBe('hvc1');
		expect(argValue(args, '-ss')).toBe('359.792');
		expect(args).not.toContain('-hwaccel');
		expect(args).not.toContain('-vf');
		expect(args.indexOf('-copyts')).toBeLessThan(args.indexOf('-ss'));
		expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
	});

	it('copies AV1 and H.264 when decodable, without a codec tag', () => {
		const av1 = plan(AV1_HDR_4K, IPHONE);
		expect(av1.video).toMatchObject({ mode: 'copy', codec: 'av1', transfer: 'pq' });
		const args = buildStreamArgs({ inputPath: 'x', startSeconds: 0, plan: av1 });
		expect(args).not.toContain('-tag:v');
		expect(args).not.toContain('-ss');
		expect(plan(H264_1080, H264_ONLY).video.mode).toBe('copy');
	});

	it('keeps Dolby Vision profile 8 as its HDR10 base layer', () => {
		expect(plan(DV8, CHROME).video).toMatchObject({ mode: 'copy', transfer: 'pq' });
		expect(plan(HLG, CHROME).video).toMatchObject({ mode: 'copy', transfer: 'hlg' });
	});

	it('transcodes on the GPU while the keyframe index is not ready yet', () => {
		const p = plan(HEVC_HDR_4K, CHROME, { hasKeyframeIndex: false });
		expect(p.video.mode).toBe('transcode');
		expect(p.segments).toBe('uniform');
		expect(p.video.reason).toBe(
			'Converted on the GPU: first play, the original stream is being prepared'
		);
	});
});

describe('GPU transcode', () => {
	it('keeps 10-bit HDR10 on HEVC Main 10 when the source codec is not decodable', () => {
		const p = plan(AV1_HDR_4K, { ...CHROME, av1: false });
		expect(p.video).toMatchObject({
			mode: 'transcode',
			codec: 'hevc',
			encoder: 'hevc_nvenc',
			width: 3840,
			height: 1746,
			tenBit: true,
			transfer: 'pq',
			toneMap: 'none',
			maxBitrate: 40e6,
			cq: 19
		});
		expect(p.video.reason).toBe('Converted on the GPU: AV1 10-bit is not supported on this device');
		const args = buildStreamArgs({ inputPath: 'x', startSeconds: 400, plan: p });
		expect(args.slice(args.indexOf('-hwaccel'), args.indexOf('-hwaccel') + 4)).toEqual([
			'-hwaccel',
			'cuda',
			'-hwaccel_output_format',
			'cuda'
		]);
		expect(argValue(args, '-vf')).toBe(
			'scale_cuda=w=3840:h=1746:interp_algo=lanczos:format=p010le'
		);
		expect(argValue(args, '-c:v')).toBe('hevc_nvenc');
		expect(argValue(args, '-profile:v')).toBe('main10');
		expect(argValue(args, '-color_trc')).toBe('smpte2084');
		expect(argValue(args, '-color_primaries')).toBe('bt2020');
		expect(argValue(args, '-colorspace')).toBe('bt2020nc');
		expect(argValue(args, '-force_key_frames')).toBe('expr:gte(t,n_forced*4)');
		expect(argValue(args, '-forced-idr')).toBe('1');
		expect(argValue(args, '-maxrate')).toBe('40000k');
		expect(argValue(args, '-preset')).toBe('p4'); // 4K: faster preset, same quality per bit
		expect(argValue(args, '-rc-lookahead')).toBe('8');
		expect(argValue(args, '-tag:v')).toBe('hvc1');
		expect(args).not.toContain('-init_hw_device');
	});

	it('keeps HLG on Main 10 and 10-bit SDR stays 10-bit without colour tags', () => {
		const hlg = plan(HLG, { ...CHROME, hevcMain10: true }, { quality: '720p' });
		expect(hlg.video).toMatchObject({ codec: 'hevc', tenBit: true, transfer: 'hlg', height: 720 });
		expect(
			argValue(buildStreamArgs({ inputPath: 'x', startSeconds: 0, plan: hlg }), '-color_trc')
		).toBe('arib-std-b67');
		const sdr10 = plan(HEVC_10_SDR_1080, CHROME, { quality: '720p' });
		expect(sdr10.video).toMatchObject({ tenBit: true, transfer: 'sdr', width: 1280, height: 544 });
		expect(buildStreamArgs({ inputPath: 'x', startSeconds: 0, plan: sdr10 })).not.toContain(
			'-color_trc'
		);
	});

	it('uses HEVC Main 8-bit with GPU tone mapping when only 8-bit HEVC decodes', () => {
		const p = plan(HEVC_HDR_4K, { ...CHROME, hevcMain10: false });
		expect(p.video).toMatchObject({
			codec: 'hevc',
			tenBit: false,
			transfer: 'sdr',
			toneMap: 'libplacebo'
		});
		const args = buildStreamArgs({ inputPath: 'x', startSeconds: 0, plan: p });
		expect(argValue(args, '-profile:v')).toBe('main');
		expect(argValue(args, '-vf')).toContain('libplacebo=colorspace=bt709');
		expect(argValue(args, '-vf')).toContain('tonemapping=bt.2390');
		expect(
			args.slice(args.indexOf('-init_hw_device'), args.indexOf('-init_hw_device') + 4)
		).toEqual(['-init_hw_device', 'vulkan=vk', '-filter_hw_device', 'vk']);
		expect(argValue(args, '-color_trc')).toBe('bt709');
		expect(p.video.reason).toBe(
			'Converted on the GPU: HEVC 10-bit is not supported on this device, HDR mapped to SDR'
		);
	});

	it('falls back to H.264 8-bit with tone mapping for an H.264-only client', () => {
		const p = plan(HEVC_HDR_4K, H264_ONLY, { quality: '1080p' });
		expect(p.video).toMatchObject({
			codec: 'h264',
			encoder: 'h264_nvenc',
			width: 1920,
			height: 800,
			toneMap: 'libplacebo',
			maxBitrate: 10e6,
			cq: 23
		});
		const args = buildStreamArgs({ inputPath: 'x', startSeconds: 0, plan: p });
		expect(argValue(args, '-c:v')).toBe('h264_nvenc');
		expect(argValue(args, '-profile:v')).toBe('high');
		expect(argValue(args, '-preset')).toBe('p5');
		expect(argValue(args, '-rc-lookahead')).toBe('20');
		expect(args).not.toContain('-b_ref_mode');
		expect(args).not.toContain('-tag:v');
	});

	it('tone-maps with zscale when Vulkan/libplacebo is unavailable', () => {
		const p = plan(HEVC_HDR_4K, H264_ONLY, { encoders: GPU_NO_VULKAN });
		expect(p.video.toneMap).toBe('zscale');
		const vf = videoFilter(p.video, true)!;
		expect(vf).toContain('hwdownload');
		expect(vf).toContain('tonemap=tonemap=hable');
		expect(buildStreamArgs({ inputPath: 'x', startSeconds: 0, plan: p })).not.toContain(
			'-init_hw_device'
		);
	});

	it('reshapes Dolby Vision profile 5 to HDR10 with libplacebo, or tone-maps without it', () => {
		const p = plan(DV5, CHROME);
		expect(p.video).toMatchObject({
			mode: 'transcode',
			tenBit: true,
			transfer: 'pq',
			doviReshape: true
		});
		expect(p.video.reason).toBe('Converted on the GPU: Dolby Vision profile 5 needs conversion');
		expect(
			argValue(buildStreamArgs({ inputPath: 'x', startSeconds: 0, plan: p }), '-vf')
		).toContain('libplacebo=colorspace=bt2020nc');
		const noVulkan = plan(DV5, CHROME, { encoders: GPU_NO_VULKAN });
		expect(noVulkan.video).toMatchObject({ tenBit: false, transfer: 'sdr', toneMap: 'zscale' });
	});

	it('honours a device height ceiling even for the original quality', () => {
		const p = plan(HEVC_HDR_4K, { ...CHROME, maxHeight: 1080 });
		expect(p.video).toMatchObject({ mode: 'transcode', width: 1920, height: 800 });
		expect(p.video.reason).toBe('Converted on the GPU: limited to 800p on this device');
	});

	it('uses lower bitrate caps for explicit quality levels', () => {
		expect(plan(HEVC_HDR_4K, CHROME, { quality: '2160p' }).video.maxBitrate).toBe(25e6);
		expect(plan(HEVC_HDR_4K, CHROME, { quality: '1080p' }).video.maxBitrate).toBe(8e6);
		expect(plan(HEVC_HDR_4K, CHROME, { quality: '720p' }).video).toMatchObject({
			maxBitrate: 4e6,
			width: 1280,
			height: 534
		});
		expect(plan(HEVC_HDR_4K, H264_ONLY, { quality: '480p' }).video).toMatchObject({
			maxBitrate: 2e6,
			width: 854,
			height: 356
		});
	});
});

describe('CPU fallback without NVENC', () => {
	it('encodes H.264 with libx264 at most at 1080p and tone-maps HDR with zscale', () => {
		const p = plan(HEVC_HDR_4K, { ...CHROME, hevcMain10: false }, { encoders: CPU });
		expect(p.video).toMatchObject({
			encoder: 'libx264',
			codec: 'h264',
			width: 1920,
			height: 800,
			toneMap: 'zscale'
		});
		const args = buildStreamArgs({ inputPath: 'x', startSeconds: 8, plan: p });
		expect(args).not.toContain('-hwaccel');
		expect(argValue(args, '-c:v')).toBe('libx264');
		expect(argValue(args, '-vf')).toBe(
			'scale=w=1920:h=800:flags=lanczos,format=yuv420p10le,zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p'
		);
		expect(p.video.reason).toContain('Converted on the CPU');
	});
});

describe('audio', () => {
	const tracks = [
		audio({ ordinal: 0, language: 'eng', isDefault: true }),
		audio({ ordinal: 1, language: 'fre', codec: 'ac3' }),
		audio({ ordinal: 2, language: 'fra', codec: 'aac', channels: 2 })
	];

	it('prefers French, then the default track, then the first', () => {
		expect(pickDefaultAudio(tracks)?.ordinal).toBe(1);
		expect(
			pickDefaultAudio([tracks[0], audio({ ordinal: 3, language: 'ger', isDefault: false })])
				?.ordinal
		).toBe(0);
		expect(pickDefaultAudio([audio({ ordinal: 5, language: null })])?.ordinal).toBe(5);
		expect(pickDefaultAudio([])).toBeNull();
	});

	it('copies Dolby audio for Apple devices and AAC everywhere', () => {
		expect(planAudio(tracks, 0, IPHONE)).toMatchObject({ mode: 'copy', codec: 'eac3', ordinal: 0 });
		expect(planAudio(tracks, 1, IPHONE)).toMatchObject({ mode: 'copy', codec: 'ac3' });
		expect(planAudio(tracks, 2, CHROME)).toMatchObject({ mode: 'copy', codec: 'aac' });
	});

	it('delays the init segment for copied Dolby audio only (dec3 needs parsed packets)', () => {
		const movflags = (caps: ClientCaps, ordinal: number) => {
			const args = buildStreamArgs({
				inputPath: 'x',
				startSeconds: 0,
				plan: plan(H264_1080, caps, { audio: ordinal })
			});
			return argValue(args, '-movflags');
		};
		expect(movflags(IPHONE, 0)).toBe(
			'+frag_keyframe+empty_moov+delay_moov+default_base_moof+frag_discont'
		);
		expect(movflags(CHROME, 0)).toBe('+frag_keyframe+empty_moov+default_base_moof+frag_discont');
		expect(movflags(IPHONE, 1)).toBe('+frag_keyframe+empty_moov+default_base_moof+frag_discont');
	});

	it('converts Dolby to AAC stereo for Chrome, 5.1 when multichannel is worth keeping', () => {
		expect(planAudio(tracks, 0, CHROME)).toEqual({
			ordinal: 0,
			mode: 'transcode',
			codec: 'aac',
			channels: 2,
			bitrate: 192_000
		});
		expect(planAudio(tracks, 0, { ...CHROME, multichannel: true })).toMatchObject({
			channels: 6,
			bitrate: 384_000
		});
		expect(planAudio([audio({ ordinal: 0, codec: 'dts', channels: 8 })], 0, IPHONE)).toMatchObject({
			mode: 'transcode',
			channels: 6
		});
		expect(planAudio([audio({ ordinal: 0, codec: 'aac', channels: 8 })], 0, CHROME)).toMatchObject({
			mode: 'transcode'
		});
	});

	it('falls back to the default track for an unknown ordinal and maps it', () => {
		expect(planAudio(tracks, 9, CHROME)?.ordinal).toBe(1);
		const p = plan(H264_1080, CHROME, { audio: 1 });
		const args = buildStreamArgs({ inputPath: 'x', startSeconds: 0, plan: p });
		expect(args.filter((a, i) => args[i - 1] === '-map')).toEqual(['0:v:0', '0:a:1']);
		expect(argValue(args, '-c:a')).toBe('copy');
	});

	it('writes AAC with resampling for transcoded audio', () => {
		const args = buildStreamArgs({
			inputPath: 'x',
			startSeconds: 0,
			plan: plan(H264_1080, CHROME)
		});
		expect(argValue(args, '-c:a')).toBe('aac');
		expect(argValue(args, '-b:a')).toBe('192k');
		expect(argValue(args, '-ac')).toBe('2');
		expect(argValue(args, '-af')).toBe('aresample=async=1');
	});

	it('streams video only when the file has no audio', () => {
		const p = plan(file({}, []), CHROME);
		expect(p.audio).toBeNull();
		const args = buildStreamArgs({ inputPath: 'x', startSeconds: 0, plan: p });
		expect(args.filter((a, i) => args[i - 1] === '-map')).toEqual(['0:v:0']);
		expect(args).not.toContain('-c:a');
	});
});

describe('muxer and timeline', () => {
	it('writes a fragmented MP4 to stdout with absolute timestamps and no edit list', () => {
		const args = buildStreamArgs({
			inputPath: 'F:/MOVIES/x.mkv',
			startSeconds: 0,
			plan: plan(HEVC_HDR_4K, CHROME)
		});
		expect(args.slice(0, 4)).toEqual(['-hide_banner', '-nostdin', '-loglevel', 'error']);
		expect(argValue(args, '-i')).toBe('F:/MOVIES/x.mkv');
		expect(argValue(args, '-f')).toBe('mp4');
		expect(argValue(args, '-movflags')).toBe(
			'+frag_keyframe+empty_moov+default_base_moof+frag_discont'
		);
		expect(argValue(args, '-use_editlist')).toBe('0');
		expect(argValue(args, '-output_ts_offset')).toBe(String(TIMELINE_OFFSET));
		expect(argValue(args, '-map_chapters')).toBe('-1');
		expect(argValue(args, '-map_metadata')).toBe('-1');
		expect(args[args.length - 1]).toBe('pipe:1');
	});
});

describe('quality levels', () => {
	it('offers levels below the source size and within the device ceiling', () => {
		expect(availableQualities(HEVC_HDR_4K, CHROME)).toEqual(['original', '1080p', '720p', '480p']);
		expect(availableQualities(HEVC_8_1080, CHROME)).toEqual(['original', '720p', '480p']);
		expect(availableQualities(HEVC_HDR_4K, { ...CHROME, maxHeight: 720 })).toEqual([
			'original',
			'720p',
			'480p'
		]);
		expect(availableQualities(file({ width: 640, height: 360 }), CHROME)).toEqual(['original']);
	});

	it('fits into a box without upscaling and keeps even sizes', () => {
		expect(fitInto(3840, 1744, [1920, 1080])).toEqual([1920, 872]);
		expect(fitInto(1280, 534, [1920, 1080])).toEqual([1280, 534]);
		expect(fitInto(1080, 1920, [1280, 720])).toEqual([406, 720]);
	});
});
