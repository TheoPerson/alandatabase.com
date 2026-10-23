// One Pointer Events recognizer for the picture area (section 6.1). Pure: it receives pointer
// samples and emits actions; the caller owns the DOM, the engine and the UI state.
import type { FrameMode } from '$lib/player/hqp/types';
import { isPortrait, type HqpLayout, type Rect, type Size } from './layout';
import { isCancel, panFineRate, relativeScrubTarget, scrubWindow } from './scrub';

export interface PointerSample {
	id: number;
	x: number;
	y: number;
	t: number;
	type: 'touch' | 'mouse' | 'pen';
}

export interface GestureConfig {
	viewport: Size;
	frame: Rect;
	layout: HqpLayout;
	duration: number;
	position: number;
	locked: boolean;
	edgeExclusion: number;
	chromeVisible: boolean;
}

/**
 * `seekTap.total` and `seekCommit.total` are signed seconds (negative = back). `seekTap.total` is
 * the running label ("−20 s"); `seekCommit.total` is the part not yet sent to the engine.
 */
export type GestureAction =
	| { type: 'toggleChrome' }
	| { type: 'revertChrome' }
	| { type: 'seekTap'; side: 'back' | 'forward'; total: number }
	| { type: 'seekCommit'; total: number }
	| { type: 'frameToggle' }
	| { type: 'hold'; on: boolean }
	| { type: 'scrubStart'; origin: number }
	| { type: 'scrubMove'; target: number; rate: 1 | 0.5 | 0.25 }
	| { type: 'scrubEnd'; target: number; cancelled: boolean }
	| { type: 'drag'; dy: number }
	| { type: 'dismiss' }
	| { type: 'dragCancel' }
	| { type: 'swipeUp' }
	| { type: 'pinch'; scale: number }
	| { type: 'pinchEnd'; mode: FrameMode | null }
	| { type: 'lockedTap' };

export interface TimerApi {
	set(fn: () => void, ms: number): number;
	clear(id: number): void;
}

export const TAP_MAX_MS = 250;
export const TAP_SLOP_PX = 10;
export const DOUBLE_TAP_MS = 300;
export const SEEK_CHAIN_MS = 600;
export const SEEK_COMMIT_MS = 250;
export const HOLD_MS = 400;
export const PAN_START_PX = 12;
export const DISMISS_PX = 120;
export const SWIPE_UP_PX = 60;
export const FLICK_PX_PER_MS = 0.5;
export const SEEK_STEP = 10;

const defaultTimers: TimerApi = {
	set: (fn, ms) => setTimeout(fn, ms) as unknown as number,
	clear: (id) => clearTimeout(id)
};

type Mode = 'idle' | 'pending' | 'hold' | 'scrub' | 'drag' | 'up' | 'pinch' | 'void' | 'locked';
type Side = 'back' | 'forward';

interface Track {
	start: PointerSample;
	last: PointerSample;
	history: PointerSample[];
}

function distance(a: PointerSample, b: PointerSample): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Vertical velocity (px/ms) over roughly the last 100 ms. */
function velocityY(history: PointerSample[]): number {
	const last = history[history.length - 1];
	let ref = last;
	for (let i = history.length - 2; i >= 0; i -= 1) {
		ref = history[i];
		if (last.t - ref.t >= 100) break;
	}
	const dt = last.t - ref.t;
	return dt > 0 ? (last.y - ref.y) / dt : 0;
}

export function createGestureRecognizer(
	config: () => GestureConfig,
	emit: (action: GestureAction) => void,
	timers: TimerApi = defaultTimers
) {
	let mode: Mode = 'idle';
	let primary: number | null = null;
	let moved = false;
	const pointers = new Map<number, Track>();

	let holdTimer: number | null = null;
	let commitTimer: number | null = null;

	let lastTapUp: number | null = null;
	let seek: { side: Side; total: number; committed: number; lastUp: number } | null = null;
	let scrub: {
		origin: number;
		target: number;
		anchorX: number;
		anchorTarget: number;
		rate: 1 | 0.5 | 0.25;
		frameWidth: number;
		duration: number;
		pxPerSecond: number;
	} | null = null;
	let pinch: { startDist: number; scale: number } | null = null;

	function clearHold() {
		if (holdTimer !== null) timers.clear(holdTimer);
		holdTimer = null;
	}

	function signed(side: Side, value: number): number {
		return side === 'back' ? -value : value;
	}

	function flushSeek() {
		if (commitTimer !== null) timers.clear(commitTimer);
		commitTimer = null;
		if (!seek) return;
		const remainder = seek.total - seek.committed;
		if (remainder !== 0) {
			seek.committed = seek.total;
			emit({ type: 'seekCommit', total: signed(seek.side, remainder) });
		}
	}

	function scheduleCommit() {
		if (commitTimer !== null) timers.clear(commitTimer);
		commitTimer = timers.set(() => {
			commitTimer = null;
			flushSeek();
		}, SEEK_COMMIT_MS);
	}

	function zoneOf(x: number, width: number): Side | 'centre' {
		if (x < width * 0.35) return 'back';
		if (x > width * 0.65) return 'forward';
		return 'centre';
	}

	function handleTap(down: PointerSample, up: PointerSample, cfg: GestureConfig) {
		const zone = zoneOf(up.x, cfg.viewport.width);

		if (seek && zone !== 'centre' && down.t - seek.lastUp <= SEEK_CHAIN_MS) {
			if (zone === seek.side) {
				seek.total += SEEK_STEP;
			} else {
				flushSeek();
				seek = { side: zone, total: SEEK_STEP, committed: 0, lastUp: up.t };
			}
			seek.lastUp = up.t;
			emit({ type: 'seekTap', side: seek.side, total: signed(seek.side, seek.total) });
			scheduleCommit();
			lastTapUp = null;
			return;
		}

		if (lastTapUp !== null && down.t - lastTapUp <= DOUBLE_TAP_MS) {
			if (zone !== 'centre') {
				flushSeek();
				emit({ type: 'revertChrome' });
				seek = { side: zone, total: SEEK_STEP, committed: 0, lastUp: up.t };
				emit({ type: 'seekTap', side: zone, total: signed(zone, SEEK_STEP) });
				scheduleCommit();
				lastTapUp = null;
				return;
			}
			if (cfg.layout === 'phone-landscape' || cfg.layout === 'large') {
				emit({ type: 'revertChrome' });
				emit({ type: 'frameToggle' });
				lastTapUp = null;
				return;
			}
		}

		emit({ type: 'toggleChrome' });
		lastTapUp = up.t;
	}

	function startScrub(p: PointerSample, track: Track, cfg: GestureConfig) {
		clearHold();
		if (mode === 'hold') emit({ type: 'hold', on: false });
		const windowSeconds = scrubWindow(cfg.duration);
		const frameWidth = cfg.frame.width > 0 ? cfg.frame.width : cfg.viewport.width;
		mode = 'scrub';
		scrub = {
			origin: cfg.position,
			target: cfg.position,
			anchorX: track.start.x,
			anchorTarget: cfg.position,
			rate: 1,
			frameWidth,
			duration: cfg.duration,
			pxPerSecond: windowSeconds > 0 ? frameWidth / windowSeconds : 0
		};
		emit({ type: 'scrubStart', origin: cfg.position });
		moveScrub(p, track);
	}

	function moveScrub(p: PointerSample, track: Track) {
		if (!scrub) return;
		const rate = panFineRate(p.y - track.start.y);
		const at = (x: number, r: 1 | 0.5 | 0.25) =>
			relativeScrubTarget(
				scrub!.anchorTarget,
				x - scrub!.anchorX,
				scrub!.frameWidth,
				scrub!.duration,
				r
			);
		let target = at(p.x, scrub.rate);
		if (rate !== scrub.rate) {
			scrub.anchorX = p.x;
			scrub.anchorTarget = target;
			scrub.rate = rate;
			target = at(p.x, rate);
		}
		scrub.target = target;
		emit({ type: 'scrubMove', target, rate });
	}

	function reset() {
		clearHold();
		mode = 'idle';
		primary = null;
		moved = false;
		scrub = null;
		pinch = null;
		pointers.clear();
	}

	function pinchDistance(): number {
		const [a, b] = [...pointers.values()];
		return a && b ? distance(a.last, b.last) : 0;
	}

	return {
		down(p: PointerSample) {
			const cfg = config();
			const track: Track = { start: p, last: p, history: [p] };
			if (pointers.size === 0) {
				pointers.set(p.id, track);
				primary = p.id;
				moved = false;
				if (cfg.locked) {
					mode = 'locked';
					return;
				}
				const edge = cfg.edgeExclusion;
				if (edge > 0 && (p.x < edge || p.x > cfg.viewport.width - edge)) {
					mode = 'void';
					return;
				}
				mode = 'pending';
				holdTimer = timers.set(() => {
					holdTimer = null;
					if (mode === 'pending' && !moved) {
						mode = 'hold';
						emit({ type: 'hold', on: true });
					}
				}, HOLD_MS);
				return;
			}

			pointers.set(p.id, track);
			if (mode === 'locked' || mode === 'void') return;
			if (
				(mode === 'pending' || mode === 'hold') &&
				pointers.size === 2 &&
				!isPortrait(cfg.layout)
			) {
				clearHold();
				if (mode === 'hold') emit({ type: 'hold', on: false });
				mode = 'pinch';
				pinch = { startDist: Math.max(1, pinchDistance()), scale: 1 };
				return;
			}
			if (mode === 'pending' || mode === 'hold') {
				clearHold();
				if (mode === 'hold') emit({ type: 'hold', on: false });
				mode = 'void';
			}
		},

		move(p: PointerSample) {
			const track = pointers.get(p.id);
			if (!track) return;
			track.last = p;
			track.history.push(p);
			if (track.history.length > 12) track.history.shift();

			if (mode === 'pinch' && pinch) {
				pinch.scale = Math.round((pinchDistance() / pinch.startDist) * 1000) / 1000;
				emit({ type: 'pinch', scale: pinch.scale });
				return;
			}
			if (p.id !== primary) return;
			const dx = p.x - track.start.x;
			const dy = p.y - track.start.y;
			const adx = Math.abs(dx);
			const ady = Math.abs(dy);

			switch (mode) {
				case 'pending':
				case 'hold': {
					const travelled = Math.hypot(dx, dy);
					if (mode === 'pending' && travelled >= TAP_SLOP_PX) {
						moved = true;
						clearHold();
					}
					if (adx > PAN_START_PX && adx > 1.5 * ady) {
						startScrub(p, track, config());
						return;
					}
					if (mode === 'hold') return;
					if (dy > PAN_START_PX && dy > 1.5 * adx) {
						clearHold();
						mode = 'drag';
						emit({ type: 'drag', dy });
						return;
					}
					if (dy < -PAN_START_PX && ady > 1.5 * adx) {
						clearHold();
						mode = 'up';
						return;
					}
					if (Math.max(adx, ady) > PAN_START_PX) {
						clearHold();
						mode = 'void';
					}
					return;
				}
				case 'scrub':
					moveScrub(p, track);
					return;
				case 'drag':
					emit({ type: 'drag', dy: Math.max(0, dy) });
					return;
				default:
					return;
			}
		},

		up(p: PointerSample) {
			const track = pointers.get(p.id);
			if (!track) return;
			track.last = p;
			track.history.push(p);
			const cfg = config();

			if (mode === 'pinch') {
				const scale = pinch?.scale ?? 1;
				emit({
					type: 'pinchEnd',
					mode: scale > 1.08 ? 'fill' : scale < 0.92 ? 'fit' : null
				});
				pinch = null;
				mode = 'void';
			} else if (p.id === primary) {
				const dy = p.y - track.start.y;
				const quick = p.t - track.start.t < TAP_MAX_MS && distance(p, track.start) < TAP_SLOP_PX;
				switch (mode) {
					case 'locked':
						if (quick && !moved) emit({ type: 'lockedTap' });
						break;
					case 'pending':
						clearHold();
						if (quick && !moved) handleTap(track.start, p, cfg);
						break;
					case 'hold':
						emit({ type: 'hold', on: false });
						break;
					case 'scrub':
						if (scrub) {
							moveScrubSilently(p, track);
							emit({
								type: 'scrubEnd',
								target: scrub.target,
								cancelled: isCancel(scrub.target, scrub.origin, scrub.pxPerSecond)
							});
						}
						break;
					case 'drag': {
						const v = velocityY(track.history);
						emit(
							dy > DISMISS_PX || v > FLICK_PX_PER_MS ? { type: 'dismiss' } : { type: 'dragCancel' }
						);
						break;
					}
					case 'up': {
						const v = velocityY(track.history);
						if (dy < -SWIPE_UP_PX || v < -FLICK_PX_PER_MS) emit({ type: 'swipeUp' });
						break;
					}
				}
				if (mode !== 'void') mode = 'void';
			}

			pointers.delete(p.id);
			if (pointers.size === 0) reset();
		},

		cancel(p: PointerSample) {
			if (!pointers.has(p.id)) return;
			switch (mode) {
				case 'hold':
					emit({ type: 'hold', on: false });
					break;
				case 'scrub':
					if (scrub) emit({ type: 'scrubEnd', target: scrub.origin, cancelled: true });
					break;
				case 'drag':
					emit({ type: 'dragCancel' });
					break;
				case 'pinch':
					emit({ type: 'pinchEnd', mode: null });
					break;
			}
			reset();
		},

		dispose() {
			clearHold();
			if (commitTimer !== null) timers.clear(commitTimer);
			commitTimer = null;
			seek = null;
			reset();
		}
	};

	function moveScrubSilently(p: PointerSample, track: Track) {
		if (!scrub) return;
		const rate = panFineRate(p.y - track.start.y);
		if (rate === scrub.rate) {
			scrub.target = relativeScrubTarget(
				scrub.anchorTarget,
				p.x - scrub.anchorX,
				scrub.frameWidth,
				scrub.duration,
				rate
			);
		}
	}
}

export type GestureRecognizer = ReturnType<typeof createGestureRecognizer>;
