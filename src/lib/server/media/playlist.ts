// HLS playlists for a playback session: a VOD media playlist listing every segment of the whole
// file with its real duration (keyframe-aligned for direct stream), and a one-variant master
// playlist carrying CODECS / VIDEO-RANGE for Apple's native player.

import { parseInitSegment } from './mp4-boxes';
import { segmentDurations } from './keyframes';

function extinf(seconds: number): string {
	return seconds.toFixed(6);
}

export function mediaPlaylist(boundaries: number[], durationSeconds: number): string {
	const durations = segmentDurations(boundaries, durationSeconds);
	const target = Math.max(1, Math.ceil(Math.max(...durations) - 1e-6));
	const lines = [
		'#EXTM3U',
		'#EXT-X-VERSION:7',
		`#EXT-X-TARGETDURATION:${target}`,
		'#EXT-X-MEDIA-SEQUENCE:0',
		'#EXT-X-PLAYLIST-TYPE:VOD',
		'#EXT-X-INDEPENDENT-SEGMENTS',
		'#EXT-X-MAP:URI="init.mp4"'
	];
	durations.forEach((duration, k) => {
		lines.push(`#EXTINF:${extinf(duration)},`, `seg-${k}.m4s`);
	});
	lines.push('#EXT-X-ENDLIST', '');
	return lines.join('\n');
}

/** RFC 6381 codec strings of an init segment, video first. */
export function codecsFromInit(init: Uint8Array): string[] {
	const tracks = parseInitSegment(init);
	return [
		...tracks.filter((t) => t.handler === 'vide').map((t) => t.codec),
		...tracks.filter((t) => t.handler === 'soun').map((t) => t.codec)
	];
}

export interface MasterVariant {
	codecs: string[];
	bandwidth: number; // peak bits/s
	averageBandwidth?: number;
	width: number;
	height: number;
	frameRate: number | null;
	videoRange: 'SDR' | 'PQ' | 'HLG';
}

export function masterPlaylist(variant: MasterVariant): string {
	const attributes = [
		`BANDWIDTH=${Math.round(variant.bandwidth)}`,
		...(variant.averageBandwidth
			? [`AVERAGE-BANDWIDTH=${Math.round(variant.averageBandwidth)}`]
			: []),
		`CODECS="${variant.codecs.join(',')}"`,
		`RESOLUTION=${variant.width}x${variant.height}`,
		...(variant.frameRate ? [`FRAME-RATE=${variant.frameRate.toFixed(3)}`] : []),
		`VIDEO-RANGE=${variant.videoRange}`
	];
	return [
		'#EXTM3U',
		'#EXT-X-VERSION:7',
		'#EXT-X-INDEPENDENT-SEGMENTS',
		`#EXT-X-STREAM-INF:${attributes.join(',')}`,
		'index.m3u8',
		''
	].join('\n');
}
