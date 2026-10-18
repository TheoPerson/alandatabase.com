// Display strings for Alan's HQP chrome: eyebrows, the Signal chip and value-first track labels.
// Strings only the lazily loaded panels use live in panel-labels.ts. Pure.
import type { PlaybackSession } from '$lib/media/types';
import type { HqpAudioOption, HqpItem, HqpStatus, HqpSubtitleState } from '$lib/player/hqp/types';
import {
	audioValue,
	channelLabel,
	hdrBadge,
	languageName,
	resolutionBadge,
	subtitleValue
} from './format';

export function runtimeLabel(minutes: number | null): string {
	if (!minutes || minutes <= 0) return '';
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "Stranger Things · S5 · E1" (short) or "… · Season 5 · Episode 1"; films: year and runtime. */
export function eyebrow(item: HqpItem, long: boolean): string {
	if (item.kind === 'episode') {
		const parts = [item.showTitle ?? ''];
		if (item.seasonNumber !== null)
			parts.push(long ? `Season ${item.seasonNumber}` : `S${item.seasonNumber}`);
		if (item.episodeNumber !== null)
			parts.push(long ? `Episode ${item.episodeNumber}` : `E${item.episodeNumber}`);
		return parts.filter(Boolean).join(' · ');
	}
	return [item.year ? String(item.year) : '', runtimeLabel(item.runtimeMinutes)]
		.filter(Boolean)
		.join(' · ');
}

/**
 * Resolution class of a picture by its width as well as its height: a 3840x1744 scope film is 4K and
 * a 1920x800 one is 1080p. Without a width, a 16:9 picture of that height is assumed.
 */
export function resolutionLabel(width: number | null | undefined, height: number): string {
	const w = width && width > 0 ? width : Math.round((height * 16) / 9);
	if (w >= 3200 || height >= 2000) return '4K';
	if (w >= 2300 || height >= 1300) return '1440p';
	if (w >= 1700 || height >= 1000) return '1080p';
	if (w >= 1150 || height >= 700) return '720p';
	return `${height}p`;
}

export type SignalTone = 'direct' | 'converted' | 'neutral';

export interface SignalInfo {
	tone: SignalTone;
	text: string;
	aria: string;
}

/** The Signal chip (section 7.1): truth about the stream on screen. */
export function signalInfo(
	session: PlaybackSession | null,
	item: HqpItem | null,
	status: HqpStatus,
	long: boolean
): SignalInfo {
	if (!session || status === 'starting' || status === 'switching' || status === 'idle') {
		return { tone: 'neutral', text: 'Preparing', aria: 'Stream: preparing. Open playback info' };
	}
	const direct = session.video.mode === 'copy';
	// The original stream is the file itself: say what the site says about it ("4K").
	const library = direct && item ? resolutionBadge(item.file.resolution) : null;
	const res = library ?? resolutionLabel(session.video.width, session.video.height);
	const hdr = session.video.hdr && item ? hdrBadge(item.file.hdr) : null;
	const details = direct ? [res, hdr].filter(Boolean) : [res];
	const head = direct ? 'Original' : 'Converted';
	const parts = [head, ...(long ? details : [])];
	if (status === 'buffering') parts.push('Buffering');
	const spoken = [head.toLowerCase(), ...details].join(', ');
	return {
		tone: direct ? 'direct' : 'converted',
		text: parts.join(' · '),
		aria: `Stream: ${spoken}${status === 'buffering' ? ', buffering' : ''}. Open playback info`
	};
}

/** Value-first Audio and Subtitles label: "FR 5.1 · CC FR" (subtitles omitted when off). */
export function tracksValue(
	audio: HqpAudioOption | undefined,
	subtitles: HqpSubtitleState
): string {
	const subs = subtitleValue(subtitles);
	const head = audioValue(audio);
	return subs === 'Off' ? head : `${head} · ${subs}`;
}

export function tracksAria(audio: HqpAudioOption | undefined, subtitles: HqpSubtitleState): string {
	const audioPart = audio
		? [languageName(audio.language), channelLabel(audio.channels)].filter(Boolean).join(' ')
		: 'default';
	const find = (ordinal: number | null) =>
		ordinal === null ? undefined : subtitles.options.find((o) => o.ordinal === ordinal);
	const selected = find(subtitles.selected);
	const forced = find(subtitles.forced);
	let subs = 'subtitles off';
	if (selected)
		subs = `subtitles ${languageName(selected.language)}${selected.forced ? ' forced' : ''}`;
	else if (forced) subs = `subtitles ${languageName(forced.language)} forced`;
	return `Audio and subtitles: ${audioPart}, ${subs}`;
}
