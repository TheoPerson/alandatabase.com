// Demo fixtures for the dev harness (/demo/hqp): a Stranger Things season 5 queue, chapters,
// trickplay, tracks and metrics. Artwork paths are real TMDB paths; no media is ever loaded.
import type { Chapter, PlayableFile, PlaybackSession, TrickplayManifest } from '$lib/media/types';
import type {
	HqpAudioOption,
	HqpItem,
	HqpLaunchPayload,
	HqpMetrics,
	HqpSubtitleOption
} from '$lib/player/hqp/types';

const STILLS = [
	'/aOOOdhkmhncbikMVqXfVxwQ6lQw.jpg',
	'/loM7T7Mwd849wFaWj9KPlNNSHZr.jpg',
	'/A9gML0mmuyE2m3hGK0eZZA2tRPg.jpg',
	'/2MaumbgBlW1NoPo3ZJO38A6v7OS.jpg',
	'/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
	'/8zbAoryWbtH0DKdev8abFAjdufy.jpg',
	'/ekLmP9wccC47PC83eJuklEy0twf.jpg',
	'/iCsM4oeBM9PIESD6PJw7mWO1xbl.jpg',
	'/kiFJZHRyTV207BhLRtUu3sAsJKh.jpg',
	'/r0uVKBsPj74lQGNRdC9IM2P5roW.jpg',
	'/xJv3oJoVQqITux8N9isJfb1Ao6g.jpg',
	'/zwJuStMjSOT1jaPUkX3dweIciRs.jpg'
];
const LOGO = '/e9qFk5zrKZaB2IbbOI9N0W77vlh.svg';

export const DEMO_DURATION = 4288; // 71:28
export const DEMO_POSITION = 2472; // 41:12

const EPISODE_TITLES = [
	"Chapitre un : L'Incursion",
	'Chapitre deux : La Disparue',
	'Chapitre trois : Le Piège',
	'Chapitre quatre : Sorcier',
	'Chapitre cinq : Shock Jock',
	'Chapitre six : Fuite',
	'Chapitre sept : Le Pont',
	'Chapitre huit : Le Monde réel'
];
const RUNTIMES = [71, 58, 64, 66, 61, 69, 77, 128];

const AUDIO: PlayableFile['audio'] = [
	{ ordinal: 0, language: 'fre', title: 'VFF E-AC3 5.1', channels: 6 },
	{ ordinal: 1, language: 'eng', title: 'VO E-AC3 5.1 Atmos', channels: 6 },
	{ ordinal: 2, language: 'fre', title: 'Audiodescription', channels: 2 }
];
const SUBTITLES: PlayableFile['subtitles'] = [
	{ ordinal: 0, language: 'fre', title: 'Forcés', forced: true, isText: true },
	{ ordinal: 1, language: 'fre', title: 'Complets', forced: false, isText: true },
	{ ordinal: 2, language: 'eng', title: 'SDH', forced: false, isText: true },
	{ ordinal: 3, language: 'eng', title: 'Full', forced: false, isText: true },
	{ ordinal: 4, language: 'fre', title: 'PGS', forced: false, isText: false }
];

function file(
	fileId: string,
	minutes: number,
	resolution: PlayableFile['resolution']
): PlayableFile {
	return {
		fileId,
		durationSeconds: minutes === 71 ? DEMO_DURATION : minutes * 60,
		resolution,
		hdr: resolution === '2160p' ? 'hdr10' : 'sdr',
		audio: AUDIO,
		subtitles: SUBTITLES
	};
}

export function demoEpisodes(): HqpItem[] {
	return EPISODE_TITLES.map((title, i) => {
		const fileId = `00000000-0000-4000-8000-00000000050${i + 1}`;
		return {
			fileId,
			kind: 'episode' as const,
			title,
			showTitle: 'Stranger Things',
			seasonNumber: 5,
			episodeNumber: i + 1,
			overview: null,
			year: 2025,
			runtimeMinutes: RUNTIMES[i],
			originalLanguage: 'en',
			artwork: {
				stillPath: STILLS[i % STILLS.length],
				backdropPath: STILLS[0],
				posterPath: null,
				logoPath: LOGO
			},
			titleHref: '/tv/66732?season=5',
			file: file(fileId, RUNTIMES[i], i < 4 ? '2160p' : '1080p'),
			progress:
				i === 0
					? {
							fileId,
							positionSeconds: DEMO_POSITION,
							durationSeconds: DEMO_DURATION,
							completed: false,
							updatedAt: '2026-10-16T20:00:00.000Z'
						}
					: null
		};
	});
}

export function demoMovie(): HqpItem {
	const fileId = '00000000-0000-4000-8000-000000000901';
	return {
		fileId,
		kind: 'movie',
		title: 'One Last Adventure: The Making of Stranger Things 5',
		showTitle: null,
		seasonNumber: null,
		episodeNumber: null,
		overview: null,
		year: 2026,
		runtimeMinutes: 71,
		originalLanguage: 'en',
		artwork: { stillPath: STILLS[3], backdropPath: STILLS[3], posterPath: null, logoPath: null },
		titleHref: '/movies/demo',
		file: file(fileId, 71, '2160p'),
		progress: null
	};
}

export function demoLaunch(kind: 'episode' | 'movie', index = 0): HqpLaunchPayload {
	if (kind === 'movie') return { queue: [demoMovie()], index: 0, returnHref: '/movies/demo' };
	return { queue: demoEpisodes(), index, returnHref: '/tv/66732?season=5' };
}

export const DEMO_CHAPTERS: Chapter[] = [
	{ start: 0, end: 95, title: 'Précédemment' },
	{ start: 95, end: 160, title: 'Générique' },
	{ start: 160, end: 905, title: 'Hawkins, novembre 1987' },
	{ start: 905, end: 2010, title: 'La quarantaine' },
	{ start: 2010, end: 2980, title: "Dans l'Upside Down" },
	{ start: 2980, end: 3790, title: 'La radio' },
	{ start: 3790, end: 4120, title: 'Le signal' },
	{ start: 4120, end: DEMO_DURATION, title: 'Générique de fin' }
];

export function demoTrickplay(): TrickplayManifest {
	return {
		status: 'ready',
		intervalSeconds: 540,
		tileWidth: 780,
		tileHeight: 439,
		columns: 1,
		rows: 1,
		sheets: STILLS.slice(0, 9).map((path) => `https://image.tmdb.org/t/p/w780${path}`)
	};
}

export function demoSession(signal: 'direct' | 'converted'): PlaybackSession {
	const direct = signal === 'direct';
	return {
		sessionId: 'demo-6f1c2a',
		playlistUrl: '/api/media/sessions/demo/index.m3u8',
		durationSeconds: DEMO_DURATION,
		segmentSeconds: 4,
		audio: 0,
		audioTracks: AUDIO.map((a) => ({
			ordinal: a.ordinal,
			label: a.title ?? '',
			language: a.language
		})),
		subtitleTracks: SUBTITLES.filter((s) => s.isText).map((s) => ({
			ordinal: s.ordinal,
			label: s.title ?? '',
			language: s.language,
			url: `/api/media/files/demo/subtitles/${s.ordinal}.vtt`,
			forced: s.forced
		})),
		video: {
			mode: direct ? 'copy' : 'transcode',
			codec: 'hevc',
			width: direct ? 3840 : 1920,
			height: direct ? 2160 : 1080,
			hdr: direct,
			reason: direct
				? 'Original stream'
				: 'Converted on the GPU: this browser cannot decode HEVC Main 10'
		},
		quality: 'original',
		qualities: ['original', '1080p', '720p', '480p'],
		audioMode: direct ? 'copy' : 'transcode'
	};
}

export function demoAudioOptions(selected = 0): HqpAudioOption[] {
	return AUDIO.map((a) => ({
		ordinal: a.ordinal,
		label: a.title ?? '',
		language: a.language,
		title: a.title,
		channels: a.channels,
		codec: 'eac3',
		isOriginal: a.language === 'eng',
		selected: a.ordinal === selected
	}));
}

export function demoSubtitleOptions(): HqpSubtitleOption[] {
	return SUBTITLES.map((s) => ({
		ordinal: s.ordinal,
		label: s.title ?? '',
		language: s.language,
		title: s.title,
		forced: s.forced,
		sdh: /sdh/i.test(s.title ?? ''),
		isText: s.isText,
		url: s.isText ? `/api/media/files/demo/subtitles/${s.ordinal}.vtt` : null
	}));
}

export const DEMO_CUE = "Tu crois qu'ils nous entendent, là-bas ?";

export function demoMetrics(signal: 'direct' | 'converted', bufferAhead: number): HqpMetrics {
	const direct = signal === 'direct';
	return {
		sessionId: 'demo-6f1c2a',
		delivery: 'hls.js',
		videoMode: direct ? 'copy' : 'transcode',
		reason: direct
			? 'Original stream'
			: 'Converted on the GPU: this browser cannot decode HEVC Main 10',
		codec: 'hevc',
		profile: direct ? 'Main 10' : 'Main',
		width: direct ? 3840 : 1920,
		height: direct ? 2160 : 1080,
		frameRate: 23.976,
		bitDepth: direct ? 10 : 8,
		hdr: direct ? 'hdr10' : 'sdr',
		hdrShown: direct,
		audio: {
			label: 'French',
			codec: direct ? 'eac3' : 'aac',
			channels: 6,
			mode: direct ? 'copy' : 'transcode'
		},
		subtitles: 'SRT → WebVTT · French forced',
		segmentSeconds: 4,
		bitrate: { measured: direct ? 18_400_000 : 7_900_000, file: 21_600_000 },
		throughput: 212_000_000,
		bufferAhead,
		frames: { dropped: 0, total: 59_212 },
		screen: { width: 440, height: 956, dpr: 3, refreshHz: 120, hdr: direct },
		quality: { choice: 'auto', active: 'original' }
	};
}
