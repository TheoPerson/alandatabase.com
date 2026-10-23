// Lock screen, Control Center and hardware media keys (spec 7.12): metadata with TMDB artwork,
// transport handlers and the position state. Every call is guarded: browsers differ in support.
import { tmdbImageUrl } from '$lib/tmdb/images';
import type { HqpArtwork, HqpItem } from './types';

export function mediaSessionArtwork(artwork: HqpArtwork): MediaImage[] {
	const wide = artwork.stillPath ?? artwork.backdropPath;
	if (wide) {
		return [
			{ src: tmdbImageUrl(wide, 'w780')!, sizes: '780x439', type: 'image/jpeg' },
			{ src: tmdbImageUrl(wide, 'w1280')!, sizes: '1280x720', type: 'image/jpeg' }
		];
	}
	return artwork.posterPath
		? [{ src: tmdbImageUrl(artwork.posterPath, 'w780')!, sizes: '780x1170', type: 'image/jpeg' }]
		: [];
}

export interface MediaSessionHandlers {
	play(): void;
	pause(): void;
	seekBy(deltaSeconds: number): void;
	seekTo(seconds: number): void;
	previous(): void;
	next: (() => void) | null;
}

const ACTIONS: MediaSessionAction[] = [
	'play',
	'pause',
	'seekbackward',
	'seekforward',
	'seekto',
	'previoustrack',
	'nexttrack'
];

export function createMediaSessionBridge(win: Window | null | undefined) {
	const ms = win?.navigator?.mediaSession ?? null;
	const Metadata = (win as (Window & { MediaMetadata?: typeof MediaMetadata }) | null)
		?.MediaMetadata;
	const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
		try {
			ms?.setActionHandler(action, handler);
		} catch {
			// Unsupported action in this browser.
		}
	};
	return {
		setItem(item: HqpItem) {
			if (!ms || !Metadata) return;
			ms.metadata = new Metadata({
				title: item.title,
				artist: item.showTitle ?? (item.year ? String(item.year) : ''),
				album: "Alan's HQP",
				artwork: mediaSessionArtwork(item.artwork)
			});
		},
		setHandlers(h: MediaSessionHandlers) {
			set('play', () => h.play());
			set('pause', () => h.pause());
			set('seekbackward', (d) => h.seekBy(-(d.seekOffset ?? 10)));
			set('seekforward', (d) => h.seekBy(d.seekOffset ?? 10));
			set('seekto', (d) => {
				if (typeof d.seekTime === 'number') h.seekTo(d.seekTime);
			});
			set('previoustrack', () => h.previous());
			const next = h.next;
			set('nexttrack', next ? () => next() : null);
		},
		setPosition(duration: number, position: number, rate: number) {
			if (!ms || !(duration > 0) || !Number.isFinite(duration)) return;
			try {
				ms.setPositionState({
					duration,
					position: Math.min(Math.max(0, position), duration),
					playbackRate: rate > 0 ? rate : 1
				});
			} catch {
				// Old engines reject some states; the lock screen just shows less.
			}
		},
		setState(state: MediaSessionPlaybackState) {
			if (ms) ms.playbackState = state;
		},
		clear() {
			if (!ms) return;
			ms.metadata = null;
			ms.playbackState = 'none';
			for (const action of ACTIONS) set(action, null);
		}
	};
}

export type MediaSessionBridge = ReturnType<typeof createMediaSessionBridge>;
