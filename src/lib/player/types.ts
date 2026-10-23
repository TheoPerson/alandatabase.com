import type { CaptionSize } from './prefs';

// The contract every playback source implements. The shell, controller and
// settings panel only ever talk to this interface, so a local-file source can
// slot in later without touching them.

export type PlayerStatus =
	'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';

export interface PlayerSnapshot {
	status: PlayerStatus;
	/** Seconds from the start. */
	position: number;
	/** Seconds; 0 until the source knows it. */
	duration: number;
	/** Seconds buffered from the start (visual only). */
	buffered: number;
	rate: number;
	/** 0–1. */
	volume: number;
	muted: boolean;
	captions: boolean;
	error?: string;
}

export interface Capabilities {
	fullscreen: boolean;
	pip: boolean;
	captions: boolean;
	rates: number[];
	boost: boolean;
	qualities: string[];
}

export type PlayerEvent = 'state' | 'time' | 'error' | 'autoplayblocked';

export interface LoadOptions {
	autoplay: boolean;
	startAt: number;
	captions: boolean;
}

export interface PlayerSource {
	load(container: HTMLElement, options: LoadOptions): Promise<void>;
	play(): void;
	pause(): void;
	seek(seconds: number): void;
	setRate(rate: number): void;
	setVolume(level: number): void;
	setMuted(muted: boolean): void;
	setCaptions(on: boolean): void;
	setCaptionSize(size: CaptionSize): void;
	getState(): PlayerSnapshot;
	on(event: PlayerEvent, handler: (snapshot: PlayerSnapshot) => void): () => void;
	capabilities(): Capabilities;
	destroy(): void;
}
