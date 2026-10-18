// Display strings for the lazily loaded panels and cards of Alan's HQP: playback info values,
// quality rows, up next meta and error cards. Kept apart from labels.ts so the first download of
// the player does not carry them. Pure.
import type { QualityLevel } from '$lib/media/types';
import type {
	HqpAudioOption,
	HqpError,
	HqpItem,
	HqpSubtitleState,
	QualityChoice
} from '$lib/player/hqp/types';
import { formatTime } from '$lib/player/format-time';
import { channelLabel, codecLabel, hdrBadge, languageName, resolutionBadge } from './format';
import { runtimeLabel } from './labels';

/**
 * Playback info Audio value from the track's fields: 'Dolby Digital Plus 5.1 · French · converted'.
 * The container title ('VFF', 'Français [Forced]') is never repeated.
 */
export function infoAudioValue(
	option: HqpAudioOption | undefined,
	mode: 'copy' | 'transcode' | null
): string {
	if (!option) return '—';
	const format = [codecLabel(option.codec), channelLabel(option.channels)]
		.filter(Boolean)
		.join(' ');
	const delivery = mode === 'copy' ? 'untouched' : mode === 'transcode' ? 'converted' : null;
	return [format, languageName(option.language), delivery].filter(Boolean).join(' · ');
}

/** Playback info Subtitles value: 'WebVTT · French · forced', 'WebVTT · English · SDH' or 'Off'. */
export function infoSubtitleValue(state: HqpSubtitleState): string {
	const shown = state.selected ?? state.forced;
	const option =
		shown === null ? undefined : state.options.find((entry) => entry.ordinal === shown);
	if (!option) return 'Off';
	const flags = [option.forced ? 'forced' : null, option.sdh ? 'SDH' : null];
	return ['WebVTT', languageName(option.language), ...flags].filter(Boolean).join(' · ');
}

const BITRATES: Partial<Record<QualityLevel, string>> = {
	'2160p': 'About 20 Mb/s',
	'1080p': 'About 8 Mb/s',
	'720p': 'About 4 Mb/s',
	'480p': 'About 1.5 Mb/s'
};

export interface QualityRow {
	choice: QualityChoice;
	label: string;
	detail: string;
	tag: string | null;
}

export function qualityRows(
	levels: QualityLevel[],
	videoMode: 'copy' | 'transcode' | null
): QualityRow[] {
	const rows: QualityRow[] = [
		{
			choice: 'auto',
			label: 'Auto',
			detail: 'Starts at Original, adapts to the connection',
			tag: null
		}
	];
	for (const level of levels) {
		if (level === 'original') {
			rows.push({
				choice: level,
				label: 'Original',
				detail:
					videoMode === 'copy' ? 'The untouched stream' : 'Best quality, converted on the GPU',
				tag: videoMode === 'copy' ? 'DIRECT' : 'GPU'
			});
		} else {
			rows.push({ choice: level, label: level, detail: BITRATES[level] ?? '', tag: null });
		}
	}
	return rows;
}

export function upNextMeta(item: HqpItem): string {
	return [
		runtimeLabel(item.runtimeMinutes),
		resolutionBadge(item.file.resolution),
		hdrBadge(item.file.hdr)
	]
		.filter(Boolean)
		.join(' · ');
}

export type ErrorAction = 'retry' | 'back' | 'signin' | 'fallback' | 'copy';

export interface ErrorCopy {
	title: string;
	body: string;
	actions: ErrorAction[];
}

/** Error cards (section 8). */
export function errorCopy(error: HqpError): ErrorCopy {
	const message = error.message?.trim() ?? '';
	switch (error.code) {
		case 'unauthorized':
			return {
				title: 'Your session expired',
				body: 'Sign in again to keep watching.',
				actions: ['signin']
			};
		case 'forbidden':
		case 'not-found':
			return { title: "This file isn't available", body: message, actions: ['back'] };
		case 'gone':
			return {
				title: 'This file has moved or is gone from the library',
				body: 'Rescan the library on the PC, then try again.',
				actions: ['back']
			};
		case 'library-offline':
			return {
				title: 'The media library is offline',
				body: 'The PC that holds the films is not reachable, or streaming is turned off.',
				actions: ['retry']
			};
		case 'decode':
			return {
				title: "This device couldn't play this stream",
				body: message,
				actions: error.fallback ? ['fallback', 'retry'] : ['retry']
			};
		case 'network':
			return { title: 'Connection lost', body: message, actions: ['retry'] };
		case 'unsupported':
			return { title: "This browser can't play HLS video", body: message, actions: ['back'] };
		default:
			return { title: 'Something went wrong', body: message, actions: ['retry', 'copy'] };
	}
}

/** "+14:52" or "−3:10" (U+2212 MINUS SIGN). */
export function deltaLabel(seconds: number): string {
	const sign = seconds < 0 ? '−' : '+';
	return `${sign}${formatTime(Math.abs(seconds))}`;
}

const CANADIAN = /\b(vfq|canad|qu[ée]bec)/i;
const DESCRIPTION = /audio ?desc|\bad\b|descriptive|malvoyant/i;

/** Row label for an audio track: "French", "French (Canada)", "French · Audio description". */
export function audioName(option: HqpAudioOption): string {
	const title = option.title ?? '';
	let name = languageName(option.language);
	if (name === 'Unknown' && option.label) name = option.label;
	if (name === 'French' && CANADIAN.test(title)) name = 'French (Canada)';
	if (DESCRIPTION.test(title)) name = `${name} · Audio description`;
	return name;
}

export function isAudioDescription(option: HqpAudioOption): boolean {
	return DESCRIPTION.test(option.title ?? '');
}

/** Row detail for an audio track: "Dolby Digital Plus 5.1 · Original". */
export function audioDetail(option: HqpAudioOption): string {
	const format = [codecLabel(option.codec), channelLabel(option.channels)]
		.filter(Boolean)
		.join(' ');
	return [format, option.isOriginal ? 'Original' : ''].filter(Boolean).join(' · ');
}
