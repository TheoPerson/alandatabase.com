// Shared contract for the owner's local media library and its streaming API.
// Pure types only: imported by the server (scanner, repository, streaming) and the client (player).
// The local file path never leaves the server: clients only ever see a MediaFile id.

export type HdrKind = 'sdr' | 'hdr10' | 'hlg' | 'dolby-vision';

export interface VideoInfo {
	codec: string; // ffprobe codec_name: hevc | h264 | av1 | ...
	profile: string | null;
	pixFmt: string | null; // yuv420p10le means 10-bit
	width: number;
	height: number;
	hdr: HdrKind;
	// Optional scanner extras (absent on rows scanned before they existed).
	dvProfile?: number | null; // Dolby Vision profile (5, 7, 8, 10) when hdr = 'dolby-vision'
	// What a display without Dolby Vision shows: the base layer's signal (null = no compatible
	// base layer, e.g. profile 5, which needs tone mapping).
	dvFallback?: 'hdr10' | 'hlg' | 'sdr' | null;
	frameRate?: number | null; // average frames per second (23.976, 25, 50, ...)
	bitRate?: number | null; // overall file bitrate, bits per second
}

export interface AudioTrack {
	ordinal: number; // position among the file's audio streams (0-based), stable across scans
	codec: string; // eac3 | ac3 | aac | dts | flac | ...
	channels: number | null;
	language: string | null; // ISO 639-2 as tagged in the file (fre, fra, eng, ...) or null
	title: string | null;
	isDefault: boolean;
}

export interface SubtitleTrack {
	// Embedded streams take ordinals 0..n-1 in stream order; external sidecar files (.srt/.vtt/.ass
	// next to the video) continue after them. External paths stay server-side in the database.
	ordinal: number;
	source: 'embedded' | 'external';
	codec: string; // subrip | ass | mov_text | hdmv_pgs_subtitle | webvtt | ...
	language: string | null;
	title: string | null;
	forced: boolean;
	// Text subtitles can be converted to WebVTT; image subtitles (PGS) cannot.
	isText: boolean;
}

export type MatchStatus = 'matched' | 'unmatched' | 'ambiguous';

export interface ParsedName {
	kind: 'movie' | 'episode' | 'unknown';
	title: string;
	year: number | null;
	season: number | null;
	episode: number | null;
}

/** One playable file as the server knows it (never sent to the client with its path). */
export interface MediaFileRecord {
	id: string;
	path: string;
	sizeBytes: number;
	durationSeconds: number | null;
	video: VideoInfo | null;
	audioTracks: AudioTrack[];
	subtitleTracks: SubtitleTrack[];
	movieId: string | null;
	episodeId: string | null;
	matchStatus: MatchStatus;
}

/** What a page may show about a playable file (owner only). */
export interface PlayableFile {
	fileId: string;
	durationSeconds: number | null;
	resolution: '2160p' | '1080p' | '720p' | 'SD' | null;
	hdr: HdrKind;
	audio: Array<Pick<AudioTrack, 'ordinal' | 'language' | 'title' | 'channels'>>;
	subtitles: Array<Pick<SubtitleTrack, 'ordinal' | 'language' | 'title' | 'forced' | 'isText'>>;
}

/** Codecs and display features the client supports, reported by the player before a session. */
export interface ClientCaps {
	h264: boolean;
	hevc: boolean;
	hevcMain10: boolean;
	av1: boolean;
	nativeHls: boolean;
	// Optional downscale ceiling chosen by the player (null = no ceiling, keep the source).
	maxHeight: number | null;
	// Audio the client decodes in fMP4/HLS (Apple devices: ac3 and eac3 too; Chrome: aac only).
	ac3?: boolean;
	eac3?: boolean;
	// The display can show HDR (matchMedia('(dynamic-range: high)')); HDR is kept when true.
	hdrDisplay?: boolean;
	// Multichannel output is worth keeping (Apple devices, AirPlay, spatial audio).
	multichannel?: boolean;
}

/**
 * 'original' = best possible picture: the untouched video stream (direct stream) when the client
 * decodes it, otherwise a high-quality GPU transcode at the source resolution. Lower levels cap the
 * height and bitrate for slow networks.
 */
export type QualityLevel = 'original' | '2160p' | '1080p' | '720p' | '480p';

/** POST /api/media/sessions request body. */
export interface StartSessionRequest {
	fileId: string;
	audio: number | null; // AudioTrack.ordinal; null = server picks (French first, then default)
	caps: ClientCaps;
	quality?: QualityLevel; // default 'original'
	// Where playback will start (resume position or quality switch); the first run starts at the
	// segment containing it instead of at 0. Default 0.
	startSeconds?: number;
}

/** POST /api/media/sessions response body (201). */
export interface PlaybackSession {
	sessionId: string;
	playlistUrl: string; // /api/media/sessions/<sessionId>/index.m3u8 (VOD, whole duration)
	// One-variant master playlist with CODECS / RESOLUTION / VIDEO-RANGE (PQ, HLG, SDR): the URL to
	// give Safari's native HLS player so it knows the stream is HEVC / HDR before loading it.
	masterPlaylistUrl?: string;
	// Start time of the segment the session began at (<= the requested startSeconds).
	startSeconds?: number;
	durationSeconds: number;
	segmentSeconds: number;
	audio: number; // the audio ordinal actually used (-1 when the file has no audio)
	audioTracks: Array<{
		ordinal: number;
		label: string;
		language: string | null;
		codec?: string; // source codec (eac3, aac, ...): optional, for labels built from fields
		channels?: number | null;
	}>;
	subtitleTracks: Array<{
		ordinal: number;
		label: string;
		language: string | null;
		url: string;
		forced?: boolean; // forced (foreign-dialogue-only) track
	}>;
	video: {
		mode: 'transcode' | 'copy';
		codec: 'h264' | 'hevc' | 'av1';
		width?: number;
		height: number;
		hdr: boolean;
		// Why this mode was chosen, for the player's info panel (e.g. "Original stream",
		// "Converted on the GPU: AV1 is not supported on this device").
		reason?: string;
	};
	quality?: QualityLevel;
	qualities?: QualityLevel[]; // levels that make sense for this file and client
	audioMode?: 'copy' | 'transcode';
	chaptersUrl?: string; // GET -> Chapter[]
	trickplayUrl?: string; // GET -> TrickplayManifest
}

export interface Chapter {
	start: number; // seconds
	end: number;
	title: string | null;
}

/** Scrub preview thumbnails stored as sprite sheets. */
export interface TrickplayManifest {
	status: 'pending' | 'ready' | 'unavailable';
	intervalSeconds: number;
	tileWidth: number;
	tileHeight: number;
	columns: number;
	rows: number;
	sheets: string[]; // image URLs, sheet n covers tiles n*columns*rows ...
}

/** Saved playback position (per owner, per file), synced across devices. */
export interface ProgressEntry {
	fileId: string;
	positionSeconds: number;
	durationSeconds: number | null;
	completed: boolean;
	updatedAt: string; // ISO
}
