import { describe, expect, it } from 'vitest';
import type { PlaybackSession } from '$lib/media/types';
import type { HqpAudioOption, HqpError, HqpItem, HqpSubtitleState } from '$lib/player/hqp/types';
import {
	eyebrow,
	resolutionLabel,
	runtimeLabel,
	signalInfo,
	tracksAria,
	tracksValue
} from './labels';
import {
	errorCopy,
	infoAudioValue,
	infoSubtitleValue,
	imageSubtitlesNote,
	subtitleDetail,
	qualityRows,
	upNextMeta
} from './panel-labels';

function item(partial: Partial<HqpItem> = {}): HqpItem {
	return {
		fileId: 'f1',
		kind: 'episode',
		title: 'Chapitre un',
		showTitle: 'Stranger Things',
		seasonNumber: 5,
		episodeNumber: 1,
		overview: null,
		year: 2025,
		runtimeMinutes: 58,
		originalLanguage: 'en',
		artwork: { stillPath: null, backdropPath: null, posterPath: null, logoPath: null },
		titleHref: '/tv/66732?season=5',
		file: {
			fileId: 'f1',
			durationSeconds: 3480,
			resolution: '2160p',
			hdr: 'hdr10',
			audio: [],
			subtitles: []
		},
		progress: null,
		...partial
	};
}

function session(video: Partial<PlaybackSession['video']>): PlaybackSession {
	return {
		sessionId: 's1',
		playlistUrl: '/x.m3u8',
		durationSeconds: 3480,
		segmentSeconds: 4,
		audio: 0,
		audioTracks: [],
		subtitleTracks: [],
		video: { mode: 'copy', codec: 'hevc', height: 2160, hdr: true, ...video }
	};
}

describe('eyebrow and runtime', () => {
	it('builds short and long episode eyebrows', () => {
		expect(eyebrow(item(), false)).toBe('Stranger Things · S5 · E1');
		expect(eyebrow(item(), true)).toBe('Stranger Things · Season 5 · Episode 1');
	});

	it('uses year and runtime for films', () => {
		expect(eyebrow(item({ kind: 'movie', showTitle: null, runtimeMinutes: 131 }), false)).toBe(
			'2025 · 2h 11m'
		);
		expect(eyebrow(item({ kind: 'movie', year: null, runtimeMinutes: null }), true)).toBe('');
	});

	it('formats runtimes', () => {
		expect(runtimeLabel(58)).toBe('58m');
		expect(runtimeLabel(120)).toBe('2h');
		expect(runtimeLabel(null)).toBe('');
	});
});

describe('signalInfo', () => {
	it('reports an original stream in emerald', () => {
		const info = signalInfo(session({}), item(), 'playing', true);
		expect(info.tone).toBe('direct');
		expect(info.text).toBe('Original · 4K · HDR10');
		expect(info.aria).toBe('Stream: original, 4K, HDR10. Open playback info');
		expect(signalInfo(session({}), item(), 'playing', false).text).toBe('Original');
	});

	it('reports a converted stream in amber', () => {
		const info = signalInfo(
			session({ mode: 'transcode', height: 1080, hdr: false }),
			item(),
			'playing',
			true
		);
		expect(info.tone).toBe('converted');
		expect(info.text).toBe('Converted · 1080p');
	});

	it('is neutral while preparing and appends buffering', () => {
		expect(signalInfo(null, item(), 'starting', true)).toMatchObject({
			tone: 'neutral',
			text: 'Preparing'
		});
		expect(signalInfo(session({}), item(), 'switching', false).text).toBe('Preparing');
		expect(signalInfo(session({}), item(), 'buffering', false).text).toBe('Original · Buffering');
	});

	it('labels resolutions by width as well as height (scope films are wide, not short)', () => {
		expect(resolutionLabel(3840, 2160)).toBe('4K');
		expect(resolutionLabel(3840, 1744)).toBe('4K');
		expect(resolutionLabel(3840, 1600)).toBe('4K');
		expect(resolutionLabel(2560, 1440)).toBe('1440p');
		expect(resolutionLabel(1920, 1080)).toBe('1080p');
		expect(resolutionLabel(1920, 800)).toBe('1080p');
		expect(resolutionLabel(1920, 824)).toBe('1080p');
		expect(resolutionLabel(1280, 534)).toBe('720p');
		expect(resolutionLabel(1280, 720)).toBe('720p');
		expect(resolutionLabel(854, 480)).toBe('480p');
		// No width: a 16:9 picture of that height.
		expect(resolutionLabel(null, 2160)).toBe('4K');
		expect(resolutionLabel(undefined, 1080)).toBe('1080p');
		expect(resolutionLabel(null, 800)).toBe('720p');
	});

	it('shows the library label of the playing file for the original stream', () => {
		const apex = item({
			kind: 'movie',
			file: { ...item().file, resolution: '2160p', hdr: 'hdr10' }
		});
		const scope4k = session({ width: 3840, height: 1744 });
		expect(signalInfo(scope4k, apex, 'playing', true).text).toBe('Original · 4K · HDR10');
		const alien = item({
			kind: 'movie',
			file: { ...item().file, resolution: '1080p', hdr: 'sdr' }
		});
		const scope1080 = session({ width: 1920, height: 824, hdr: false });
		expect(signalInfo(scope1080, alien, 'playing', true).text).toBe('Original · 1080p');
		// Without a library label, the stream size decides.
		const unknown = item({ file: { ...item().file, resolution: null, hdr: 'sdr' } });
		expect(
			signalInfo(session({ width: 1920, height: 800, hdr: false }), unknown, 'playing', true).text
		).toBe('Original · 1080p');
	});

	it('labels a converted scope stream by its width', () => {
		const info = signalInfo(
			session({ mode: 'transcode', width: 1920, height: 874, hdr: false }),
			item(),
			'playing',
			true
		);
		expect(info.text).toBe('Converted · 1080p');
		expect(
			signalInfo(
				session({ mode: 'transcode', width: 1280, height: 534, hdr: false }),
				item(),
				'playing',
				true
			).text
		).toBe('Converted · 720p');
	});
});

describe('tracksValue', () => {
	const fr: HqpAudioOption = {
		ordinal: 0,
		label: 'Français',
		language: 'fre',
		title: null,
		channels: 6,
		codec: 'eac3',
		isOriginal: false,
		selected: true
	};
	const subs = (selected: number | null, forced: number | null = null): HqpSubtitleState => ({
		options: [
			{
				ordinal: 0,
				label: 'FR',
				language: 'fre',
				title: null,
				forced: false,
				sdh: false,
				isText: true,
				url: '/0.vtt'
			},
			{
				ordinal: 1,
				label: 'FR forced',
				language: 'fre',
				title: null,
				forced: true,
				sdh: false,
				isText: true,
				url: '/1.vtt'
			}
		],
		selected,
		forced,
		offsetSeconds: 0
	});

	it('is value-first', () => {
		expect(tracksValue(fr, subs(0))).toBe('FR 5.1 · CC FR');
		expect(tracksValue(fr, subs(null))).toBe('FR 5.1');
		expect(tracksValue(undefined, subs(null))).toBe('Audio');
	});

	it('has a spoken label with values', () => {
		expect(tracksAria(fr, subs(null, 1))).toBe(
			'Audio and subtitles: French 5.1, subtitles French forced'
		);
		expect(tracksAria(fr, subs(null))).toBe('Audio and subtitles: French 5.1, subtitles off');
	});
});

describe('qualityRows', () => {
	it('lists Auto then the server levels with tags and bitrates', () => {
		const rows = qualityRows(['original', '1080p', '720p'], 'copy');
		expect(rows.map((r) => r.choice)).toEqual(['auto', 'original', '1080p', '720p']);
		expect(rows[1]).toMatchObject({ label: 'Original', tag: 'DIRECT' });
		expect(rows[2]).toMatchObject({ label: '1080p', detail: 'About 8 Mb/s' });
		expect(qualityRows(['original'], 'transcode')[1].tag).toBe('GPU');
	});
});

describe('upNextMeta', () => {
	it('joins runtime, resolution and HDR', () => {
		expect(upNextMeta(item())).toBe('58m · 4K · HDR10');
	});
});

describe('errorCopy', () => {
	const err = (code: HqpError['code'], message = ''): HqpError => ({
		code,
		status: null,
		message,
		fallback: code === 'decode' ? '1080p' : null
	});

	it('maps every code to a title and actions', () => {
		expect(errorCopy(err('library-offline'))).toMatchObject({
			title: 'The media library is offline',
			actions: ['retry']
		});
		expect(errorCopy(err('unauthorized')).actions).toEqual(['signin']);
		expect(errorCopy(err('gone')).title).toBe('This file has moved or is gone from the library');
		expect(errorCopy(err('decode')).actions).toEqual(['fallback', 'retry']);
		expect(errorCopy(err('unsupported')).actions).toEqual(['back']);
		expect(errorCopy(err('unknown', 'Boom')).body).toBe('Boom');
		expect(errorCopy(err('unknown', 'Boom')).actions).toEqual(['retry', 'copy']);
	});
});

describe('playback info values (built from fields, never the container title)', () => {
	const audio = (partial: Partial<HqpAudioOption> = {}): HqpAudioOption => ({
		ordinal: 1,
		label: 'Dolby Digital Plus 5.1 – VFF',
		language: 'fre',
		title: 'VFF',
		channels: 6,
		codec: 'eac3',
		isOriginal: false,
		selected: true,
		...partial
	});
	it('reads format, channels, language and delivery once each', () => {
		expect(infoAudioValue(audio(), 'transcode')).toBe(
			'Dolby Digital Plus 5.1 · French · converted'
		);
		expect(infoAudioValue(audio({ codec: 'aac', channels: 2, language: 'eng' }), 'copy')).toBe(
			'AAC Stereo · English · untouched'
		);
		expect(infoAudioValue(audio({ codec: null, channels: null, language: null }), null)).toBe(
			'Unknown'
		);
		expect(infoAudioValue(undefined, 'copy')).toBe('—');
	});
	const subs = (selected: number | null, forced: number | null): HqpSubtitleState => ({
		options: [
			{
				ordinal: 2,
				label: 'French (forced) – Français [Forced]',
				language: 'fre',
				title: 'Français [Forced]',
				forced: true,
				sdh: false,
				isText: true,
				url: '/s/2.vtt'
			},
			{
				ordinal: 3,
				label: 'English SDH',
				language: 'eng',
				title: 'SDH',
				forced: false,
				sdh: true,
				isText: true,
				url: '/s/3.vtt'
			}
		],
		selected,
		forced,
		offsetSeconds: 0
	});
	it('says forced once and names SDH', () => {
		expect(infoSubtitleValue(subs(null, 2))).toBe('WebVTT · French · forced');
		expect(infoSubtitleValue(subs(3, 2))).toBe('WebVTT · English · SDH');
		expect(infoSubtitleValue(subs(null, null))).toBe('Off');
	});
});

describe('subtitleDetail', () => {
	const sub = (partial: Partial<HqpSubtitleState['options'][number]>) => ({
		ordinal: 3,
		label: 'French',
		language: 'fre',
		title: null,
		forced: false,
		sdh: false,
		isText: true,
		url: null,
		...partial
	});

	it('turns raw MKV titles into a kind and a format', () => {
		expect(subtitleDetail(sub({ title: 'FR Forced : SRT', forced: true }))).toBe('Forced · SRT');
		expect(subtitleDetail(sub({ title: 'FR Full : SRT' }))).toBe('Full · SRT');
		expect(subtitleDetail(sub({ title: 'ENG Full : SRT', language: 'eng' }))).toBe('Full · SRT');
		expect(subtitleDetail(sub({ title: 'English SDH', language: 'eng', sdh: true }))).toBe('SDH');
	});

	it('uses the flags when the title says nothing more', () => {
		expect(subtitleDetail(sub({ title: null, forced: true }))).toBe('Forced');
		expect(subtitleDetail(sub({ title: 'Français', forced: false }))).toBe('');
		expect(subtitleDetail(sub({ title: 'French' }))).toBe('');
	});

	it('keeps a meaningful free title, without the spaced colon', () => {
		expect(subtitleDetail(sub({ title: 'Commentary : director' }))).toBe('Commentary · director');
	});
});

describe('imageSubtitlesNote', () => {
	const image = (language: string | null) => ({
		ordinal: 9,
		label: '',
		language,
		title: null,
		forced: false,
		sdh: false,
		isText: false,
		url: null
	});

	it('folds image tracks into one line', () => {
		expect(imageSubtitlesNote([])).toBeNull();
		expect(imageSubtitlesNote([image('fre')])).toBe('French image subtitles can’t be shown here');
		expect(imageSubtitlesNote([image('fre'), image('fre')])).toBe(
			'2 image subtitle tracks (French) can’t be shown here'
		);
		expect(imageSubtitlesNote([image('fre'), image('eng')])).toBe(
			'2 image subtitle tracks (French, English) can’t be shown here'
		);
		expect(imageSubtitlesNote([image(null)])).toBe('1 image subtitle track can’t be shown here');
	});
});
