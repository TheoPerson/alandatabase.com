// Human labels for audio and subtitle tracks ("French · Dolby Digital Plus 5.1", "English (forced)").

import type { AudioTrack, SubtitleTrack } from '$lib/media/types';

// ISO 639-2/B codes (as tagged in Matroska) -> 639-2/T, which Intl understands.
const B_TO_T: Record<string, string> = {
	fre: 'fra',
	ger: 'deu',
	dut: 'nld',
	chi: 'zho',
	cze: 'ces',
	gre: 'ell',
	per: 'fas',
	rum: 'ron',
	slo: 'slk',
	alb: 'sqi',
	arm: 'hye',
	baq: 'eus',
	bur: 'mya',
	geo: 'kat',
	ice: 'isl',
	mac: 'mkd',
	mao: 'mri',
	may: 'msa',
	tib: 'bod',
	wel: 'cym'
};

const names = new Intl.DisplayNames(['en'], { type: 'language' });

export function languageName(code: string | null | undefined): string | null {
	if (!code) return null;
	const lower = code.toLowerCase();
	if (lower === 'und' || lower === 'zxx' || lower === 'mul' || lower === 'mis') return null;
	const normalized = B_TO_T[lower] ?? lower;
	try {
		const name = names.of(normalized);
		if (name && name.toLowerCase() !== normalized)
			return name.charAt(0).toUpperCase() + name.slice(1);
	} catch {
		// not a language code
	}
	return code;
}

const AUDIO_CODECS: Record<string, string> = {
	eac3: 'Dolby Digital Plus',
	ac3: 'Dolby Digital',
	truehd: 'Dolby TrueHD',
	aac: 'AAC',
	dts: 'DTS',
	flac: 'FLAC',
	opus: 'Opus',
	mp3: 'MP3',
	vorbis: 'Vorbis',
	pcm_s16le: 'PCM',
	pcm_s24le: 'PCM'
};

function layout(channels: number | null): string {
	if (!channels) return '';
	if (channels === 1) return 'Mono';
	if (channels === 2) return 'Stereo';
	if (channels === 6) return '5.1';
	if (channels === 8) return '7.1';
	return `${channels} ch`;
}

function withDuplicatesResolved<T>(
	items: T[],
	base: (item: T) => string,
	extra: (item: T) => string | null
): string[] {
	const bases = items.map(base);
	return items.map((item, i) => {
		const same = bases.filter((b) => b === bases[i]).length > 1;
		if (!same) return bases[i];
		const detail = extra(item)?.trim();
		return detail
			? `${bases[i]} – ${detail}`
			: `${bases[i]} #${bases.slice(0, i + 1).filter((b) => b === bases[i]).length}`;
	});
}

export function audioLabels(tracks: AudioTrack[]): string[] {
	return withDuplicatesResolved(
		tracks,
		(t) => {
			const codec = AUDIO_CODECS[t.codec] ?? t.codec.toUpperCase();
			const parts = [codec, layout(t.channels)].filter(Boolean).join(' ');
			return `${languageName(t.language) ?? 'Unknown language'} · ${parts}`;
		},
		(t) => t.title
	);
}

const SDH = /\b(sdh|cc|malentendants?|hearing)\b/iu;

export function subtitleLabels(tracks: SubtitleTrack[]): string[] {
	return withDuplicatesResolved(
		tracks,
		(t) => {
			const tags = [t.forced ? 'forced' : null, t.title && SDH.test(t.title) ? 'SDH' : null].filter(
				Boolean
			);
			const name = languageName(t.language) ?? 'Unknown language';
			return tags.length ? `${name} (${tags.join(', ')})` : name;
		},
		(t) => t.title
	);
}
