import { describe, expect, it } from 'vitest';
import type { AudioTrack, SubtitleTrack } from '$lib/media/types';
import { audioLabels, languageName, subtitleLabels } from './labels';

const a = (p: Partial<AudioTrack>): AudioTrack => ({
	ordinal: 0,
	codec: 'eac3',
	channels: 6,
	language: 'fre',
	title: null,
	isDefault: false,
	...p
});
const s = (p: Partial<SubtitleTrack>): SubtitleTrack => ({
	ordinal: 0,
	source: 'embedded',
	codec: 'subrip',
	language: 'fre',
	title: null,
	forced: false,
	isText: true,
	...p
});

describe('track labels', () => {
	it('names ISO 639-2 B and T codes', () => {
		expect(languageName('fre')).toBe('French');
		expect(languageName('fra')).toBe('French');
		expect(languageName('eng')).toBe('English');
		expect(languageName('ger')).toBe('German');
		expect(languageName('und')).toBeNull();
		expect(languageName(null)).toBeNull();
	});

	it('describes audio by language, codec and layout, disambiguating duplicates', () => {
		expect(
			audioLabels([
				a({ title: 'VFF' }),
				a({ title: 'VFQ' }),
				a({ language: 'eng', codec: 'aac', channels: 2 }),
				a({ language: null, codec: 'dts', channels: 8 })
			])
		).toEqual([
			'French · Dolby Digital Plus 5.1 – VFF',
			'French · Dolby Digital Plus 5.1 – VFQ',
			'English · AAC Stereo',
			'Unknown language · DTS 7.1'
		]);
		expect(audioLabels([a({}), a({})])).toEqual([
			'French · Dolby Digital Plus 5.1 #1',
			'French · Dolby Digital Plus 5.1 #2'
		]);
	});

	it('marks forced and SDH subtitles', () => {
		expect(
			subtitleLabels([s({ forced: true }), s({ title: 'FR SDH : SRT' }), s({ language: 'eng' })])
		).toEqual(['French (forced)', 'French (SDH)', 'English']);
	});
});
