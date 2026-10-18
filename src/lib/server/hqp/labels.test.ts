import { describe, expect, it } from 'vitest';
import type { AudioTrack, PlayableFile } from '$lib/media/types';
import {
	audioFormatLabel,
	audioLanguages,
	primaryAudio,
	progressFraction,
	qualityLine,
	remainingLabel,
	remainingSpoken
} from './labels';

const track = (overrides: Partial<AudioTrack>): AudioTrack => ({
	ordinal: 0,
	codec: 'eac3',
	channels: 6,
	language: 'fre',
	title: null,
	isDefault: false,
	...overrides
});

const file: PlayableFile = {
	fileId: '00000000-0000-4000-8000-000000000001',
	durationSeconds: 7200,
	resolution: '2160p',
	hdr: 'hdr10',
	audio: [
		{ ordinal: 0, language: 'eng', title: null, channels: 6 },
		{ ordinal: 1, language: 'fre', title: 'VFF', channels: 6 }
	],
	subtitles: []
};

describe('quality line', () => {
	it('reads resolution, HDR, the French track format and the languages', () => {
		const tracks = [track({ ordinal: 0, language: 'eng', isDefault: true }), track({ ordinal: 1 })];
		expect(qualityLine(file, tracks)).toBe('4K · HDR10 · Dolby Digital Plus 5.1 · English, French');
	});

	it('omits SDR and unknown parts and falls back to the ids-only tracks', () => {
		expect(qualityLine({ ...file, resolution: '1080p', hdr: 'sdr' })).toBe(
			'1080p · English, French'
		);
		expect(qualityLine({ ...file, resolution: null, hdr: 'sdr', audio: [] })).toBe('');
		expect(qualityLine({ ...file, hdr: 'dolby-vision' }, [])).toBe(
			'4K · Dolby Vision · English, French'
		);
	});

	it('names codecs and layouts', () => {
		expect(audioFormatLabel({ codec: 'aac', channels: 2 })).toBe('AAC Stereo');
		expect(audioFormatLabel({ codec: 'ac3', channels: 6 })).toBe('Dolby Digital 5.1');
		expect(audioFormatLabel({ codec: 'dts', channels: 8 })).toBe('DTS 7.1');
		expect(audioFormatLabel({ codec: 'opus', channels: null })).toBe('Opus');
		expect(audioFormatLabel({ codec: 'mlp', channels: 3 })).toBe('MLP 3 ch');
	});

	it('picks French first, then the default track, then the first', () => {
		expect(
			primaryAudio([track({ language: 'eng' }), track({ ordinal: 1, language: 'fra' })])?.ordinal
		).toBe(1);
		expect(
			primaryAudio([
				track({ language: 'eng' }),
				track({ ordinal: 1, language: 'spa', isDefault: true })
			])?.ordinal
		).toBe(1);
		expect(primaryAudio([track({ language: null })])?.ordinal).toBe(0);
		expect(primaryAudio([])).toBeNull();
	});

	it('lists distinct known languages, three at most', () => {
		expect(
			audioLanguages([
				{ language: 'fre' },
				{ language: 'fra' },
				{ language: 'und' },
				{ language: null },
				{ language: 'eng' },
				{ language: 'ger' },
				{ language: 'spa' }
			])
		).toEqual(['French', 'English', 'German']);
	});
});

describe('remaining time', () => {
	it('rounds up to whole minutes and switches to hours', () => {
		expect(remainingLabel(600, 3060)).toBe('41 min left');
		expect(remainingLabel(0, 6720)).toBe('1 h 52 min left');
		expect(remainingLabel(0, 7200)).toBe('2 h left');
		expect(remainingLabel(3599, 3600)).toBe('1 min left');
		expect(remainingLabel(100, null)).toBeNull();
	});

	it('spells it out for screen readers', () => {
		expect(remainingSpoken(600, 3060)).toBe('41 minutes left');
		expect(remainingSpoken(0, 3660)).toBe('1 hour 1 minute left');
		expect(remainingSpoken(0, 7200)).toBe('2 hours left');
		expect(remainingSpoken(0, 0)).toBeNull();
	});

	it('clamps the watched fraction', () => {
		expect(progressFraction(900, 3600)).toBe(0.25);
		expect(progressFraction(5000, 3600)).toBe(1);
		expect(progressFraction(-5, 3600)).toBe(0);
		expect(progressFraction(10, null)).toBe(0);
	});
});
