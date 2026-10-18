import type { AudioTrack, HdrKind, PlayableFile } from '$lib/media/types';
import { languageName } from '../media/labels';

// Display labels for the owner's local copies: the quality line under Play, the Versions menu
// and the "N min left" captions. Pure functions over ids-only data (never a path).

const RESOLUTION: Record<string, string> = {
	'2160p': '4K',
	'1080p': '1080p',
	'720p': '720p',
	SD: 'SD'
};
const HDR: Partial<Record<HdrKind, string>> = {
	hdr10: 'HDR10',
	hlg: 'HLG',
	'dolby-vision': 'Dolby Vision'
};
const AUDIO_CODECS: Record<string, string> = {
	eac3: 'Dolby Digital Plus',
	ac3: 'Dolby Digital',
	truehd: 'Dolby TrueHD',
	aac: 'AAC',
	dts: 'DTS',
	flac: 'FLAC',
	opus: 'Opus',
	mp3: 'MP3'
};
const FRENCH = new Set(['fre', 'fra', 'fr']);

export function resolutionLabel(resolution: PlayableFile['resolution']): string | null {
	return resolution ? (RESOLUTION[resolution] ?? null) : null;
}

export function hdrLabel(hdr: HdrKind): string | null {
	return HDR[hdr] ?? null;
}

function channelLayout(channels: number | null): string | null {
	if (!channels) return null;
	if (channels === 1) return 'Mono';
	if (channels === 2) return 'Stereo';
	if (channels === 6) return '5.1';
	if (channels === 8) return '7.1';
	return `${channels} ch`;
}

/** "Dolby Digital Plus 5.1", "AAC Stereo"; null without a codec. */
export function audioFormatLabel(track: Pick<AudioTrack, 'codec' | 'channels'>): string | null {
	if (!track.codec) return null;
	const codec = AUDIO_CODECS[track.codec] ?? track.codec.toUpperCase();
	return [codec, channelLayout(track.channels)].filter(Boolean).join(' ');
}

/** The track the server plays by default: French first, then the default flag, then the first. */
export function primaryAudio<T extends Pick<AudioTrack, 'language' | 'isDefault'>>(
	tracks: T[]
): T | null {
	return (
		tracks.find((track) => FRENCH.has((track.language ?? '').toLowerCase())) ??
		tracks.find((track) => track.isDefault) ??
		tracks[0] ??
		null
	);
}

/** Distinct audio languages in track order, at most three ("French, English"). */
export function audioLanguages(tracks: Array<Pick<AudioTrack, 'language'>>): string[] {
	const names: string[] = [];
	for (const track of tracks) {
		const name = languageName(track.language);
		if (name && !names.includes(name)) names.push(name);
	}
	return names.slice(0, 3);
}

/**
 * "4K · HDR10 · Dolby Digital Plus 5.1 · French, English". `tracks` are the full audio tracks
 * of the same file when known (codecs live server-side), else the file's own ids-only tracks.
 */
export function qualityLine(file: PlayableFile, tracks?: AudioTrack[] | null): string {
	const audio = tracks && tracks.length > 0 ? tracks : null;
	const primary = audio ? primaryAudio(audio) : null;
	const languages = audioLanguages(audio ?? file.audio);
	return [
		resolutionLabel(file.resolution),
		hdrLabel(file.hdr),
		primary ? audioFormatLabel(primary) : null,
		languages.length > 0 ? languages.join(', ') : null
	]
		.filter((part): part is string => Boolean(part))
		.join(' · ');
}

function remainingMinutes(positionSeconds: number, durationSeconds: number | null): number | null {
	if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0)
		return null;
	const position = Number.isFinite(positionSeconds) ? Math.max(0, positionSeconds) : 0;
	return Math.max(1, Math.ceil((durationSeconds - Math.min(position, durationSeconds)) / 60));
}

/** "41 min left", "1 h 52 min left"; null when the duration is unknown. */
export function remainingLabel(
	positionSeconds: number,
	durationSeconds: number | null
): string | null {
	const minutes = remainingMinutes(positionSeconds, durationSeconds);
	if (minutes === null) return null;
	if (minutes < 60) return `${minutes} min left`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest === 0 ? `${hours} h left` : `${hours} h ${rest} min left`;
}

/** The same remaining time spelled out for screen readers ("41 minutes left"). */
export function remainingSpoken(
	positionSeconds: number,
	durationSeconds: number | null
): string | null {
	const minutes = remainingMinutes(positionSeconds, durationSeconds);
	if (minutes === null) return null;
	const unit = (value: number, word: string) => `${value} ${word}${value === 1 ? '' : 's'}`;
	if (minutes < 60) return `${unit(minutes, 'minute')} left`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest === 0
		? `${unit(hours, 'hour')} left`
		: `${unit(hours, 'hour')} ${unit(rest, 'minute')} left`;
}

/** Watched fraction 0..1 (0 when the duration is unknown). */
export function progressFraction(positionSeconds: number, durationSeconds: number | null): number {
	if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0)
		return 0;
	if (!Number.isFinite(positionSeconds)) return 0;
	return Math.min(1, Math.max(0, positionSeconds / durationSeconds));
}
