import { describe, expect, it } from 'vitest';
import {
	createGestureRecognizer,
	type GestureAction,
	type GestureConfig,
	type PointerSample,
	type TimerApi
} from './gestures';

function fakeTimers() {
	let now = 0;
	let nextId = 0;
	const pending = new Map<number, { at: number; fn: () => void }>();
	const api: TimerApi = {
		set(fn, ms) {
			nextId += 1;
			pending.set(nextId, { at: now + ms, fn });
			return nextId;
		},
		clear(id) {
			pending.delete(id);
		}
	};
	function advanceTo(target: number) {
		for (;;) {
			let soonest: [number, { at: number; fn: () => void }] | null = null;
			for (const entry of pending) {
				if (entry[1].at <= target && (!soonest || entry[1].at < soonest[1].at)) soonest = entry;
			}
			if (!soonest) break;
			pending.delete(soonest[0]);
			now = soonest[1].at;
			soonest[1].fn();
		}
		now = Math.max(now, target);
	}
	return { api, advanceTo };
}

const LANDSCAPE: GestureConfig = {
	viewport: { width: 956, height: 440 },
	frame: { x: 87, y: 0, width: 782, height: 440 },
	layout: 'phone-landscape',
	duration: 2400,
	position: 1000,
	locked: false,
	edgeExclusion: 0,
	chromeVisible: false
};

const PORTRAIT: GestureConfig = {
	...LANDSCAPE,
	viewport: { width: 440, height: 956 },
	frame: { x: 0, y: 287, width: 440, height: 247.5 },
	layout: 'phone-portrait'
};

function setup(config: Partial<GestureConfig> = {}, base: GestureConfig = LANDSCAPE) {
	const timers = fakeTimers();
	const actions: GestureAction[] = [];
	const cfg = { ...base, ...config };
	const recognizer = createGestureRecognizer(
		() => cfg,
		(action) => actions.push(action),
		timers.api
	);
	const sample = (x: number, y: number, t: number, id = 1): PointerSample => ({
		id,
		x,
		y,
		t,
		type: 'touch'
	});
	return {
		actions,
		cfg,
		timers,
		down(x: number, y: number, t: number, id = 1) {
			timers.advanceTo(t);
			recognizer.down(sample(x, y, t, id));
		},
		move(x: number, y: number, t: number, id = 1) {
			timers.advanceTo(t);
			recognizer.move(sample(x, y, t, id));
		},
		up(x: number, y: number, t: number, id = 1) {
			timers.advanceTo(t);
			recognizer.up(sample(x, y, t, id));
		},
		cancel(x: number, y: number, t: number, id = 1) {
			timers.advanceTo(t);
			recognizer.cancel(sample(x, y, t, id));
		},
		tap(x: number, y: number, t: number, length = 60) {
			this.down(x, y, t);
			this.up(x, y, t + length);
		},
		recognizer
	};
}

const types = (actions: GestureAction[]) => actions.map((a) => a.type);

describe('tap and double tap', () => {
	it('toggles the chrome immediately on a short tap', () => {
		const g = setup();
		g.tap(478, 220, 0);
		expect(g.actions).toEqual([{ type: 'toggleChrome' }]);
	});

	it('ignores a press longer than 250 ms that is not a long press', () => {
		const g = setup();
		g.down(478, 220, 0);
		g.up(478, 220, 300);
		expect(g.actions).toEqual([]);
	});

	it('ignores a press that moved 10 px or more without becoming a pan', () => {
		const g = setup();
		g.down(478, 220, 0);
		g.move(486, 228, 40);
		g.up(486, 228, 80);
		expect(g.actions).toEqual([]);
	});

	it('reverts the chrome and seeks forward on a right-side double tap, committing 250 ms later', () => {
		const g = setup();
		g.tap(800, 220, 0);
		g.tap(800, 220, 200);
		expect(g.actions).toEqual([
			{ type: 'toggleChrome' },
			{ type: 'revertChrome' },
			{ type: 'seekTap', side: 'forward', total: 10 }
		]);
		g.timers.advanceTo(260 + 249);
		expect(types(g.actions)).not.toContain('seekCommit');
		g.timers.advanceTo(260 + 250);
		expect(g.actions.at(-1)).toEqual({ type: 'seekCommit', total: 10 });
	});

	it('seeks back on the left 35%, with a signed total', () => {
		const g = setup();
		g.tap(100, 220, 0);
		g.tap(100, 220, 150);
		g.timers.advanceTo(1000);
		expect(g.actions.slice(1)).toEqual([
			{ type: 'revertChrome' },
			{ type: 'seekTap', side: 'back', total: -10 },
			{ type: 'seekCommit', total: -10 }
		]);
	});

	it('does not count a second tap after 300 ms as a double tap', () => {
		const g = setup();
		g.tap(800, 220, 0);
		g.tap(800, 220, 400);
		expect(g.actions).toEqual([{ type: 'toggleChrome' }, { type: 'toggleChrome' }]);
	});

	it('accumulates further taps within 600 ms and commits once after the last', () => {
		const g = setup();
		g.tap(800, 220, 0);
		g.tap(800, 220, 150);
		g.tap(800, 220, 330);
		g.tap(800, 220, 520);
		g.timers.advanceTo(2000);
		expect(g.actions.filter((a) => a.type === 'seekTap')).toEqual([
			{ type: 'seekTap', side: 'forward', total: 10 },
			{ type: 'seekTap', side: 'forward', total: 20 },
			{ type: 'seekTap', side: 'forward', total: 30 }
		]);
		expect(g.actions.filter((a) => a.type === 'seekCommit')).toEqual([
			{ type: 'seekCommit', total: 30 }
		]);
	});

	it('commits only the remainder when a tap lands after an earlier commit', () => {
		const g = setup();
		g.tap(100, 220, 0);
		g.tap(100, 220, 150); // up at 210, commit at 460
		g.tap(100, 220, 600); // within 600 ms of 210
		g.timers.advanceTo(3000);
		expect(g.actions.filter((a) => a.type === 'seekCommit')).toEqual([
			{ type: 'seekCommit', total: -10 },
			{ type: 'seekCommit', total: -10 }
		]);
		expect(g.actions.filter((a) => a.type === 'seekTap').at(-1)).toEqual({
			type: 'seekTap',
			side: 'back',
			total: -20
		});
	});

	it('restarts the count when the side changes', () => {
		const g = setup();
		g.tap(800, 220, 0);
		g.tap(800, 220, 150);
		g.tap(100, 220, 330);
		expect(g.actions.at(-1)).toEqual({ type: 'seekTap', side: 'back', total: -10 });
		g.timers.advanceTo(2000);
		expect(g.actions.filter((a) => a.type === 'seekCommit')).toEqual([
			{ type: 'seekCommit', total: 10 },
			{ type: 'seekCommit', total: -10 }
		]);
	});

	it('toggles Fit/Fill on a centre double tap in landscape and large', () => {
		const g = setup();
		g.tap(478, 220, 0);
		g.tap(478, 220, 150);
		expect(g.actions).toEqual([
			{ type: 'toggleChrome' },
			{ type: 'revertChrome' },
			{ type: 'frameToggle' }
		]);
		const large = setup({ layout: 'large', viewport: { width: 1440, height: 900 } });
		large.tap(720, 450, 0);
		large.tap(720, 450, 150);
		expect(types(large.actions)).toEqual(['toggleChrome', 'revertChrome', 'frameToggle']);
	});

	it('treats a centre double tap in portrait as two plain taps', () => {
		const g = setup({}, PORTRAIT);
		g.tap(220, 400, 0);
		g.tap(220, 400, 150);
		expect(types(g.actions)).toEqual(['toggleChrome', 'toggleChrome']);
	});

	it('still seeks on a side double tap in portrait', () => {
		const g = setup({}, PORTRAIT);
		g.tap(400, 400, 0);
		g.tap(400, 400, 150);
		expect(g.actions.at(-1)).toEqual({ type: 'seekTap', side: 'forward', total: 10 });
	});
});

describe('long press', () => {
	it('holds 2x after 400 ms and releases on up', () => {
		const g = setup();
		g.down(478, 220, 0);
		g.timers.advanceTo(399);
		expect(g.actions).toEqual([]);
		g.timers.advanceTo(400);
		expect(g.actions).toEqual([{ type: 'hold', on: true }]);
		g.up(478, 220, 1500);
		expect(g.actions).toEqual([
			{ type: 'hold', on: true },
			{ type: 'hold', on: false }
		]);
	});

	it('turns into a scrub when panned, releasing 2x first', () => {
		const g = setup();
		g.down(478, 220, 0);
		g.timers.advanceTo(450);
		g.move(560, 222, 500);
		expect(types(g.actions)).toEqual(['hold', 'hold', 'scrubStart', 'scrubMove']);
		expect(g.actions[1]).toEqual({ type: 'hold', on: false });
		g.up(560, 222, 600);
		expect(g.actions.at(-1)).toMatchObject({ type: 'scrubEnd', cancelled: false });
	});

	it('never holds when the finger moved first', () => {
		const g = setup();
		g.down(478, 220, 0);
		g.move(478, 232, 100);
		g.timers.advanceTo(600);
		expect(types(g.actions)).not.toContain('hold');
	});
});

describe('horizontal pan scrub', () => {
	it('scrubs relatively: the picture width spans min(25% of duration, 600 s)', () => {
		const g = setup();
		g.down(300, 220, 0);
		g.move(320, 222, 30);
		expect(g.actions[0]).toEqual({ type: 'scrubStart', origin: 1000 });
		g.move(691, 222, 60);
		expect(g.actions.at(-1)).toEqual({ type: 'scrubMove', target: 1300, rate: 1 });
		g.up(691, 222, 90);
		expect(g.actions.at(-1)).toEqual({ type: 'scrubEnd', target: 1300, cancelled: false });
	});

	it('does not start for a mostly vertical move', () => {
		const g = setup();
		g.down(300, 220, 0);
		g.move(315, 205, 30);
		expect(types(g.actions)).not.toContain('scrubStart');
	});

	it('slows down with vertical drift without jumping', () => {
		const g = setup();
		g.down(300, 220, 0);
		g.move(691, 220, 40); // +300 s at full rate
		g.move(691, 280, 80); // drift 60 px: half speed from here
		expect(g.actions.at(-1)).toEqual({ type: 'scrubMove', target: 1300, rate: 0.5 });
		g.move(1082, 280, 120); // one more picture width at half speed: +300 s * 0.5
		expect(g.actions.at(-1)).toEqual({ type: 'scrubMove', target: 1450, rate: 0.5 });
		g.move(1082, 350, 160);
		expect(g.actions.at(-1)).toMatchObject({ rate: 0.25, target: 1450 });
	});

	it('cancels when released back at the origin', () => {
		const g = setup();
		g.down(300, 220, 0);
		g.move(400, 220, 40);
		g.move(303, 220, 80);
		g.up(303, 220, 120);
		expect(g.actions.at(-1)).toMatchObject({ type: 'scrubEnd', cancelled: true });
	});

	it('ends cancelled on pointercancel', () => {
		const g = setup();
		g.down(300, 220, 0);
		g.move(400, 220, 40);
		g.cancel(400, 220, 60);
		expect(g.actions.at(-1)).toEqual({ type: 'scrubEnd', target: 1000, cancelled: true });
	});
});

describe('vertical swipes', () => {
	it('follows the finger down and dismisses past 120 px', () => {
		const g = setup({}, PORTRAIT);
		g.down(220, 400, 0);
		g.move(222, 430, 100);
		expect(g.actions).toEqual([{ type: 'drag', dy: 30 }]);
		g.move(224, 530, 400);
		g.up(224, 530, 700);
		expect(g.actions.at(-1)).toEqual({ type: 'dismiss' });
	});

	it('dismisses on a fast flick under 120 px', () => {
		const g = setup({}, PORTRAIT);
		g.down(220, 400, 0);
		g.move(220, 420, 20);
		g.move(220, 445, 40);
		g.up(220, 450, 50);
		expect(g.actions.at(-1)).toEqual({ type: 'dismiss' });
	});

	it('springs back on a slow short drag', () => {
		const g = setup({}, PORTRAIT);
		g.down(220, 400, 0);
		g.move(220, 430, 200);
		g.move(220, 450, 600);
		g.up(220, 450, 900);
		expect(g.actions.at(-1)).toEqual({ type: 'dragCancel' });
	});

	it('opens Episodes or Info on a swipe up', () => {
		const g = setup({}, PORTRAIT);
		g.down(220, 600, 0);
		g.move(220, 560, 100);
		g.move(220, 520, 300);
		g.up(220, 520, 400);
		expect(g.actions).toEqual([{ type: 'swipeUp' }]);
	});

	it('ignores a short slow upward move', () => {
		const g = setup({}, PORTRAIT);
		g.down(220, 600, 0);
		g.move(220, 580, 200);
		g.move(220, 570, 500);
		g.up(220, 570, 800);
		expect(g.actions).toEqual([]);
	});
});

describe('pinch', () => {
	it('emits a live scale and picks Fill above 1.08', () => {
		const g = setup();
		g.down(400, 220, 0, 1);
		g.down(560, 220, 10, 2);
		g.move(380, 220, 40, 1);
		g.move(580, 220, 40, 2);
		expect(g.actions.at(-1)).toEqual({ type: 'pinch', scale: 1.25 });
		g.up(580, 220, 80, 2);
		expect(g.actions.at(-1)).toEqual({ type: 'pinchEnd', mode: 'fill' });
		g.up(380, 220, 90, 1);
		expect(types(g.actions)).not.toContain('toggleChrome');
	});

	it('picks Fit below 0.92 and nothing in between', () => {
		const g = setup();
		g.down(400, 220, 0, 1);
		g.down(600, 220, 10, 2);
		g.move(420, 220, 40, 1);
		g.move(580, 220, 40, 2);
		g.up(580, 220, 80, 2);
		expect(g.actions.at(-1)).toEqual({ type: 'pinchEnd', mode: 'fit' });

		const h = setup();
		h.down(400, 220, 0, 1);
		h.down(600, 220, 10, 2);
		h.move(395, 220, 40, 1);
		h.up(600, 220, 80, 2);
		expect(h.actions.at(-1)).toMatchObject({ type: 'pinchEnd', mode: null });
	});

	it('is disabled in portrait', () => {
		const g = setup({}, PORTRAIT);
		g.down(150, 400, 0, 1);
		g.down(290, 400, 10, 2);
		g.move(100, 400, 40, 1);
		g.move(340, 400, 40, 2);
		g.up(340, 400, 80, 2);
		g.up(100, 400, 90, 1);
		expect(types(g.actions)).not.toContain('pinch');
		expect(types(g.actions)).not.toContain('pinchEnd');
	});
});

describe('lock and edge exclusion', () => {
	it('ignores everything but a tap while locked', () => {
		const g = setup({ locked: true });
		g.down(300, 220, 0);
		g.move(500, 220, 50);
		g.up(500, 220, 100);
		g.down(300, 220, 400);
		g.timers.advanceTo(1200);
		g.up(300, 220, 1200);
		expect(g.actions).toEqual([]);
		g.tap(300, 220, 2000);
		expect(g.actions).toEqual([{ type: 'lockedTap' }]);
	});

	it('ignores touches starting within the edge exclusion', () => {
		const g = setup({ edgeExclusion: 24 });
		g.tap(10, 220, 0);
		g.tap(950, 220, 500);
		g.down(12, 220, 1000);
		g.move(300, 220, 1050);
		g.up(300, 220, 1100);
		expect(g.actions).toEqual([]);
		g.tap(30, 220, 2000);
		expect(g.actions).toEqual([{ type: 'toggleChrome' }]);
	});

	it('clears its timers on dispose', () => {
		const g = setup();
		g.down(478, 220, 0);
		g.recognizer.dispose();
		g.timers.advanceTo(1000);
		expect(g.actions).toEqual([]);
	});
});
