import { describe, expect, it } from 'vitest';
import type { HqpAudioOption, HqpSubtitleOption, HqpSubtitleState } from '$lib/player/hqp/types';
import {
	audioValue,
	channelLabel,
	codecLabel,
	endsAt,
	frenchTypography,
	hdrBadge,
	languageName,
	languageShort,
	meaningfulChapterTitle,
	resolutionBadge,
	sliderText,
	subtitleValue,
	titleText
} from './format';
import { audioDetail, audioName, deltaLabel } from './panel-labels';

function audio(partial: Partial<HqpAudioOption>): HqpAudioOption {
	return {
		ordinal: 0,
		label: 'French',
		language: 'fre',
		title: null,
		channels: 6,
		codec: 'eac3',
		isOriginal: false,
		selected: true,
		...partial
	};
}

function sub(partial: Partial<HqpSubtitleOption>): HqpSubtitleOption {
	return {
		ordinal: 0,
		label: 'French',
		language: 'fre',
		title: null,
		forced: false,
		sdh: false,
		isText: true,
		url: '/s/0.vtt',
		...partial
	};
}

describe('languageName', () => {
	it('names ISO 639-2 (both forms) and 639-1 codes', () => {
		expect(languageName('fre')).toBe('French');
		expect(languageName('fra')).toBe('French');
		expect(languageName('fr')).toBe('French');
		expect(languageName('eng')).toBe('English');
		expect(languageName('ger')).toBe('German');
		expect(languageName('deu')).toBe('German');
		expect(languageName('jpn')).toBe('Japanese');
		expect(languageName('ENG')).toBe('English');
	});

	it('falls back to the code, or Unknown', () => {
		expect(languageName(null)).toBe('Unknown');
		expect(languageName('und')).toBe('Unknown');
		expect(languageName('')).toBe('Unknown');
		expect(languageName('xyz')).toBe('XYZ');
	});

	it('gives two-letter forms for compact values', () => {
		expect(languageShort('fre')).toBe('FR');
		expect(languageShort('eng')).toBe('EN');
		expect(languageShort('xyz')).toBe('XY');
		expect(languageShort(null)).toBe('');
	});
});

describe('channelLabel', () => {
	it('labels common layouts', () => {
		expect(channelLabel(1)).toBe('Mono');
		expect(channelLabel(2)).toBe('Stereo');
		expect(channelLabel(6)).toBe('5.1');
		expect(channelLabel(8)).toBe('7.1');
		expect(channelLabel(4)).toBe('4 ch');
		expect(channelLabel(null)).toBeNull();
		expect(channelLabel(0)).toBeNull();
	});
});

describe('codecLabel', () => {
	it('names audio, video and subtitle codecs, long and short', () => {
		expect(codecLabel('eac3')).toBe('Dolby Digital Plus');
		expect(codecLabel('eac3', true)).toBe('DD+');
		expect(codecLabel('ac3', true)).toBe('DD');
		expect(codecLabel('aac')).toBe('AAC');
		expect(codecLabel('truehd')).toBe('Dolby TrueHD');
		expect(codecLabel('dts')).toBe('DTS');
		expect(codecLabel('hevc')).toBe('HEVC');
		expect(codecLabel('h264')).toBe('H.264');
		expect(codecLabel('av1')).toBe('AV1');
		expect(codecLabel('subrip')).toBe('SRT');
		expect(codecLabel('hdmv_pgs_subtitle')).toBe('PGS');
		expect(codecLabel('weird')).toBe('WEIRD');
		expect(codecLabel(null)).toBeNull();
	});
});

describe('badges', () => {
	it('labels resolution and HDR', () => {
		expect(resolutionBadge('2160p')).toBe('4K');
		expect(resolutionBadge('1080p')).toBe('1080p');
		expect(resolutionBadge('SD')).toBe('SD');
		expect(resolutionBadge(null)).toBeNull();
		expect(hdrBadge('hdr10')).toBe('HDR10');
		expect(hdrBadge('hlg')).toBe('HLG');
		expect(hdrBadge('dolby-vision')).toBe('Dolby Vision');
		expect(hdrBadge('sdr')).toBeNull();
	});
});

describe('endsAt', () => {
	it('gives a 24-hour clock time rounded to the minute, scaled by the playback rate', () => {
		expect(endsAt(new Date(2026, 9, 16, 21, 40, 30), 1816, 1)).toBe('22:11');
		expect(endsAt(new Date(2026, 9, 16, 21, 40), 3600, 2)).toBe('22:10');
		expect(endsAt(new Date(2026, 9, 16, 23, 50), 1200, 1)).toBe('00:10');
	});

	it('treats a broken rate as 1x', () => {
		expect(endsAt(new Date(2026, 9, 16, 8, 0), 600, 0)).toBe('08:10');
	});
});

describe('deltaLabel', () => {
	it('uses a plus sign or U+2212', () => {
		expect(deltaLabel(892)).toBe('+14:52');
		expect(deltaLabel(-190)).toBe('−3:10');
		expect(deltaLabel(0)).toBe('+0:00');
		expect(deltaLabel(3725)).toBe('+1:02:05');
	});
});

describe('audioValue and subtitleValue', () => {
	it('summarises the audio track', () => {
		expect(audioValue(audio({}))).toBe('FR 5.1');
		expect(audioValue(audio({ language: 'eng', channels: 2 }))).toBe('EN 2.0');
		expect(audioValue(audio({ channels: 1 }))).toBe('FR Mono');
		expect(audioValue(audio({ channels: null }))).toBe('FR');
		expect(audioValue(audio({ language: null, channels: null }))).toBe('Audio');
		expect(audioValue(undefined)).toBe('Audio');
	});

	it('summarises subtitles: off, full, forced', () => {
		const options = [
			sub({ ordinal: 2, forced: true }),
			sub({ ordinal: 3 }),
			sub({ ordinal: 4, language: 'eng' })
		];
		const base: HqpSubtitleState = { options, selected: null, forced: null, offsetSeconds: 0 };
		expect(subtitleValue(base)).toBe('Off');
		expect(subtitleValue({ ...base, forced: 2 })).toBe('CC FR forced');
		expect(subtitleValue({ ...base, selected: 3 })).toBe('CC FR');
		expect(subtitleValue({ ...base, selected: 4, forced: 2 })).toBe('CC EN');
		expect(subtitleValue({ ...base, selected: 2 })).toBe('CC FR forced');
		expect(subtitleValue({ ...base, selected: 99 })).toBe('Off');
	});
});

describe('audioName and audioDetail', () => {
	it('names French (Canada) for VFQ tracks and marks audio description', () => {
		expect(audioName(audio({ title: 'VFQ' }))).toBe('French (Canada)');
		expect(audioName(audio({ title: 'Québec 5.1' }))).toBe('French (Canada)');
		expect(audioName(audio({ title: 'Audiodescription' }))).toBe('French · Audio description');
		expect(audioName(audio({ language: 'eng', title: null }))).toBe('English');
	});

	it('details codec, channels and Original', () => {
		expect(audioDetail(audio({ isOriginal: true }))).toBe('Dolby Digital Plus 5.1 · Original');
		expect(audioDetail(audio({ codec: null, channels: 2 }))).toBe('Stereo');
		expect(audioDetail(audio({ codec: null, channels: null }))).toBe('');
	});
});

describe('sliderText', () => {
	it('speaks position, duration and chapter', () => {
		expect(sliderText(2472, 4260, { start: 2400, end: 3000, title: "Dans l'Upside Down" })).toBe(
			"41 minutes 12 seconds of 1 hour 11 minutes, chapter Dans l'Upside Down"
		);
		expect(sliderText(5, 60, null)).toBe('5 seconds of 1 minute');
		expect(sliderText(5, 60, { start: 0, end: 60, title: null })).toBe('5 seconds of 1 minute');
	});

	it('never speaks a generated chapter name', () => {
		expect(sliderText(601, 6968, { start: 529, end: 700, title: '(05)00:08:49:278' })).toBe(
			'10 minutes 1 second of 1 hour 56 minutes 8 seconds'
		);
		expect(sliderText(5, 60, { start: 0, end: 60, title: 'Chapter 1' })).toBe(
			'5 seconds of 1 minute'
		);
	});
});

describe('meaningfulChapterTitle', () => {
	it('drops timecodes, bare numbers and numbered generic names', () => {
		for (const raw of [
			'(01)00:00:00:000',
			'(05)00:08:49:278',
			'00:08:49.278',
			'00:08:49',
			'1:02:03',
			'(12) 01:02:03.456',
			'12',
			'  07 ',
			'Chapter 1',
			'chapter 12',
			'Chapitre 3',
			'Kapitel 4',
			'Capítulo 2',
			'Capitulo 2',
			'Scène 5',
			'Scene 5',
			'',
			'   '
		]) {
			expect(meaningfulChapterTitle(raw), raw).toBeNull();
		}
		expect(meaningfulChapterTitle(null)).toBeNull();
	});

	it('keeps real names, trimmed', () => {
		expect(meaningfulChapterTitle('  La quarantaine ')).toBe('La quarantaine');
		expect(meaningfulChapterTitle('Générique de fin')).toBe('Générique de fin');
		expect(meaningfulChapterTitle('Chapter 1: The Arrival')).toBe('Chapter 1: The Arrival');
		expect(meaningfulChapterTitle('1984')).toBeNull();
		expect(meaningfulChapterTitle('Opening Credits')).toBe('Opening Credits');
	});
});

describe('frenchTypography', () => {
	it('puts a narrow no-break space before ? ! : ;', () => {
		expect(frenchTypography('Tu crois qu’ils nous entendent, là-bas ?')).toBe(
			'Tu crois qu’ils nous entendent, là-bas ?'
		);
		expect(frenchTypography('Attends!')).toBe('Attends !');
		expect(frenchTypography('Quoi ?!')).toBe('Quoi ?!');
		expect(frenchTypography('Il dit : non')).toBe('Il dit : non');
	});

	it('leaves clock times and URLs alone', () => {
		expect(frenchTypography('Rendez-vous à 12:30')).toBe('Rendez-vous à 12:30');
		expect(frenchTypography('https://x.y')).toBe('https://x.y');
	});
});

describe('more languages from the library', () => {
	it('names Balkan and other tracks found in the files', () => {
		expect(languageName('srp')).toBe('Serbian');
		expect(languageName('hrv')).toBe('Croatian');
		expect(languageName('per')).toBe('Persian');
		expect(languageShort('slk')).toBe('SK');
	});
});

describe('titleText', () => {
	it('keeps French punctuation on the line of the word before it', () => {
		expect(titleText('Chapitre deux : La Disparue')).toBe('Chapitre deux : La Disparue');
		expect(titleText('Qui ? Quoi ! Où ; ici')).toBe('Qui ? Quoi ! Où ; ici');
	});
	it('leaves English titles untouched', () => {
		expect(titleText('Alien: Earth')).toBe('Alien: Earth');
		expect(titleText('What If...?')).toBe('What If...?');
	});
});
