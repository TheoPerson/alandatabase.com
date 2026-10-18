import { spawn } from 'node:child_process';
import type {
	AudioTrack,
	HdrKind,
	SubtitleTrack,
	VideoInfo
} from '../../../src/lib/media/types.js';

/** What the scanner stores about one file's streams. */
export interface ProbeResult {
	durationSeconds: number | null;
	video: VideoInfo | null;
	audioTracks: AudioTrack[];
	subtitleTracks: SubtitleTrack[];
}

const TEXT_SUBTITLE_CODECS = new Set(['subrip', 'srt', 'ass', 'ssa', 'mov_text', 'webvtt', 'text']);

type Json = Record<string, unknown>;

function record(value: unknown): Json {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

function str(value: unknown): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function num(value: unknown): number | null {
	const parsed =
		typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	return Number.isFinite(parsed) ? parsed : null;
}

function language(tags: Json): string | null {
	const value = str(tags.language)?.toLowerCase() ?? null;
	return value === 'und' ? null : value;
}

function frameRate(value: unknown): number | null {
	const text = str(value);
	if (!text) return null;
	const [top, bottom] = text.split('/').map(Number);
	const rate = bottom ? top / bottom : top;
	return Number.isFinite(rate) && rate > 0 ? Math.round(rate * 1000) / 1000 : null;
}

const DV_FALLBACK: Record<number, VideoInfo['dvFallback']> = {
	1: 'hdr10',
	2: 'sdr',
	4: 'hlg',
	6: 'hdr10'
};

function videoInfo(stream: Json, format: Json): VideoInfo {
	const sideData = Array.isArray(stream.side_data_list) ? stream.side_data_list.map(record) : [];
	const dovi = sideData.find((entry) => entry.side_data_type === 'DOVI configuration record');
	const transfer = str(stream.color_transfer);
	let hdr: HdrKind = 'sdr';
	if (dovi) hdr = 'dolby-vision';
	else if (transfer === 'smpte2084') hdr = 'hdr10';
	else if (transfer === 'arib-std-b67') hdr = 'hlg';

	const compatibility = dovi ? num(dovi.dv_bl_signal_compatibility_id) : null;
	return {
		codec: str(stream.codec_name) ?? 'unknown',
		profile: str(stream.profile),
		pixFmt: str(stream.pix_fmt),
		width: num(stream.width) ?? 0,
		height: num(stream.height) ?? 0,
		hdr,
		dvProfile: dovi ? num(dovi.dv_profile) : null,
		dvFallback: compatibility !== null ? (DV_FALLBACK[compatibility] ?? null) : null,
		frameRate: frameRate(stream.avg_frame_rate) ?? frameRate(stream.r_frame_rate),
		bitRate: num(format.bit_rate)
	};
}

/** Maps `ffprobe -show_format -show_streams` JSON to the contract types. Pure. */
export function mapProbe(json: unknown): ProbeResult {
	const root = record(json);
	const format = record(root.format);
	const streams = Array.isArray(root.streams) ? root.streams.map(record) : [];

	const duration = num(format.duration);
	const videoStream = streams.find(
		(stream) => stream.codec_type === 'video' && record(stream.disposition).attached_pic !== 1
	);

	const audioTracks: AudioTrack[] = streams
		.filter((stream) => stream.codec_type === 'audio')
		.map((stream, ordinal) => {
			const tags = record(stream.tags);
			return {
				ordinal,
				codec: str(stream.codec_name) ?? 'unknown',
				channels: num(stream.channels),
				language: language(tags),
				title: str(tags.title),
				isDefault: record(stream.disposition).default === 1
			};
		});

	const subtitleTracks: SubtitleTrack[] = streams
		.filter((stream) => stream.codec_type === 'subtitle')
		.map((stream, ordinal) => {
			const tags = record(stream.tags);
			const codec = str(stream.codec_name) ?? 'unknown';
			return {
				ordinal,
				source: 'embedded',
				codec,
				language: language(tags),
				title: str(tags.title),
				forced: record(stream.disposition).forced === 1,
				isText: TEXT_SUBTITLE_CODECS.has(codec)
			};
		});

	return {
		durationSeconds: duration !== null && duration > 0 ? Math.round(duration * 1000) / 1000 : null,
		video: videoStream ? videoInfo(videoStream, format) : null,
		audioTracks,
		subtitleTracks
	};
}

/** Runs ffprobe (argument array, no shell) on one file and maps the result. Read-only. */
export function probeFile(
	path: string,
	ffprobePath: string,
	timeoutMs = 120_000
): Promise<ProbeResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(
			ffprobePath,
			['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path],
			{ stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
		);
		const chunks: Buffer[] = [];
		let stderr = '';
		const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
		child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => {
			if (stderr.length < 2000) stderr += chunk.toString('utf8');
		});
		child.on('error', (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			if (code !== 0) {
				reject(new Error(`ffprobe exited with ${code}: ${stderr.trim().slice(0, 300)}`));
				return;
			}
			try {
				resolve(mapProbe(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
			} catch (error) {
				reject(error instanceof Error ? error : new Error('ffprobe output unreadable'));
			}
		});
	});
}
