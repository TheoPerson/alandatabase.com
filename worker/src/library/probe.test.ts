import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapProbe } from './probe.js';
import { matchSidecars } from './sidecars.js';

const hdr10Movie = {
	format: { duration: '7634.627000', bit_rate: '20512345' },
	streams: [
		{
			index: 0,
			codec_type: 'video',
			codec_name: 'hevc',
			profile: 'Main 10',
			pix_fmt: 'yuv420p10le',
			width: 3840,
			height: 2074,
			color_transfer: 'smpte2084',
			avg_frame_rate: '24000/1001',
			disposition: { default: 1, attached_pic: 0 }
		},
		{
			index: 1,
			codec_type: 'audio',
			codec_name: 'eac3',
			channels: 6,
			tags: { language: 'fre', title: 'VFF 5.1' },
			disposition: { default: 1 }
		},
		{
			index: 2,
			codec_type: 'audio',
			codec_name: 'aac',
			channels: 2,
			tags: { language: 'und' },
			disposition: { default: 0 }
		},
		{
			index: 3,
			codec_type: 'subtitle',
			codec_name: 'subrip',
			tags: { language: 'fre', title: 'FR Forced' },
			disposition: { forced: 1 }
		},
		{
			index: 4,
			codec_type: 'subtitle',
			codec_name: 'hdmv_pgs_subtitle',
			tags: { language: 'eng' },
			disposition: { forced: 0 }
		},
		{
			index: 5,
			codec_type: 'video',
			codec_name: 'mjpeg',
			width: 600,
			height: 900,
			disposition: { attached_pic: 1 }
		}
	]
};

describe('mapProbe', () => {
	it('maps an HDR10 file to the contract types', () => {
		const result = mapProbe(hdr10Movie);
		assert.equal(result.durationSeconds, 7634.627);
		assert.deepEqual(result.video, {
			codec: 'hevc',
			profile: 'Main 10',
			pixFmt: 'yuv420p10le',
			width: 3840,
			height: 2074,
			hdr: 'hdr10',
			dvProfile: null,
			dvFallback: null,
			frameRate: 23.976,
			bitRate: 20512345
		});
		assert.deepEqual(result.audioTracks, [
			{
				ordinal: 0,
				codec: 'eac3',
				channels: 6,
				language: 'fre',
				title: 'VFF 5.1',
				isDefault: true
			},
			{ ordinal: 1, codec: 'aac', channels: 2, language: null, title: null, isDefault: false }
		]);
		assert.deepEqual(result.subtitleTracks, [
			{
				ordinal: 0,
				source: 'embedded',
				codec: 'subrip',
				language: 'fre',
				title: 'FR Forced',
				forced: true,
				isText: true
			},
			{
				ordinal: 1,
				source: 'embedded',
				codec: 'hdmv_pgs_subtitle',
				language: 'eng',
				title: null,
				forced: false,
				isText: false
			}
		]);
	});

	it('detects HLG, SDR and Dolby Vision (with its fallback layer)', () => {
		const video = (extra: Record<string, unknown>) => ({
			streams: [{ codec_type: 'video', codec_name: 'hevc', width: 1920, height: 1080, ...extra }]
		});
		assert.equal(mapProbe(video({ color_transfer: 'arib-std-b67' })).video?.hdr, 'hlg');
		assert.equal(mapProbe(video({ color_transfer: 'bt709' })).video?.hdr, 'sdr');
		assert.equal(mapProbe(video({})).video?.hdr, 'sdr');

		const dv = mapProbe(
			video({
				color_transfer: 'smpte2084',
				side_data_list: [
					{ side_data_type: 'Mastering display metadata' },
					{
						side_data_type: 'DOVI configuration record',
						dv_profile: 8,
						dv_bl_signal_compatibility_id: 1
					}
				]
			})
		).video;
		assert.equal(dv?.hdr, 'dolby-vision');
		assert.equal(dv?.dvProfile, 8);
		assert.equal(dv?.dvFallback, 'hdr10');

		const profile5 = mapProbe(
			video({
				side_data_list: [
					{
						side_data_type: 'DOVI configuration record',
						dv_profile: 5,
						dv_bl_signal_compatibility_id: 0
					}
				]
			})
		).video;
		assert.equal(profile5?.hdr, 'dolby-vision');
		assert.equal(profile5?.dvFallback, null);
	});

	it('marks text subtitle codecs and tolerates missing data', () => {
		const result = mapProbe({
			streams: ['ass', 'ssa', 'mov_text', 'webvtt', 'dvd_subtitle'].map((codec) => ({
				codec_type: 'subtitle',
				codec_name: codec
			}))
		});
		assert.deepEqual(
			result.subtitleTracks.map((track) => track.isText),
			[true, true, true, true, false]
		);
		assert.equal(result.video, null);
		assert.equal(result.durationSeconds, null);
		assert.deepEqual(mapProbe(null), {
			durationSeconds: null,
			video: null,
			audioTracks: [],
			subtitleTracks: []
		});
	});
});

describe('matchSidecars', () => {
	it('matches Plex-style sidecars by base-name prefix with language and forced flags', () => {
		const result = matchSidecars(
			'Fils De (2025).mp4',
			[
				{
					path: 'D/Fils De (2025).3959.fra.forced.srt',
					name: 'Fils De (2025).3959.fra.forced.srt',
					inSubsFolder: false
				},
				{
					path: 'D/Fils De (2025).3960.fra.srt',
					name: 'Fils De (2025).3960.fra.srt',
					inSubsFolder: false
				},
				{ path: 'D/Fils De (2025).en.srt', name: 'Fils De (2025).en.srt', inSubsFolder: false },
				{
					path: 'D/Other Film (2025).fra.srt',
					name: 'Other Film (2025).fra.srt',
					inSubsFolder: false
				},
				{ path: 'D/Fils De (2025).nfo', name: 'Fils De (2025).nfo', inSubsFolder: false }
			],
			3
		);
		assert.deepEqual(result, [
			{
				path: 'D/Fils De (2025).3960.fra.srt',
				codec: 'subrip',
				language: 'fre',
				title: null,
				forced: false
			},
			{
				path: 'D/Fils De (2025).3959.fra.forced.srt',
				codec: 'subrip',
				language: 'fre',
				title: 'Forced',
				forced: true
			},
			{
				path: 'D/Fils De (2025).en.srt',
				codec: 'subrip',
				language: 'eng',
				title: null,
				forced: false
			}
		]);
	});

	it('reads suffixes like .vf, .french and .eng, and an exact base name as unknown language', () => {
		const names = ['Film.vf.srt', 'Film.french.ass', 'Film.eng.vtt', 'Film.srt'];
		const result = matchSidecars(
			'Film.mkv',
			names.map((name) => ({ path: name, name, inSubsFolder: false })),
			1
		);
		assert.deepEqual(
			result.map((sub) => [sub.codec, sub.language]),
			[
				['ass', 'fre'],
				['subrip', 'fre'],
				['webvtt', 'eng'],
				['subrip', null]
			]
		);
	});

	it('uses a Subs folder only for a single-video folder and keeps French, English and unknown', () => {
		const subs = [
			'English.srt',
			'Forced.eng.srt',
			'SDH.eng.HI.srt',
			'fre.srt',
			'ger.srt',
			'Simplified.chi.srt'
		].map((name) => ({ path: `Subs/${name}`, name, inSubsFolder: true }));
		const single = matchSidecars('Titan.2025.mp4', subs, 1);
		assert.deepEqual(
			single.map((sub) => [sub.path, sub.language, sub.forced, sub.title]),
			[
				['Subs/fre.srt', 'fre', false, null],
				['Subs/English.srt', 'eng', false, null],
				['Subs/Forced.eng.srt', 'eng', true, 'Forced'],
				['Subs/SDH.eng.HI.srt', 'eng', false, 'SDH']
			]
		);
		assert.deepEqual(matchSidecars('Titan.2025.mp4', subs, 2), []);
	});
});
