import { describe, expect, it } from 'vitest';
import { createController } from './controller';
import { DEFAULT_PREFS } from './prefs';
import type { PlayerSnapshot, PlayerSource } from './types';

function fakeSource() {
	let snapshot: PlayerSnapshot = {
		status: 'ready',
		position: 0,
		duration: 100,
		buffered: 0,
		rate: 1,
		volume: 1,
		muted: false,
		captions: false
	};
	const calls: string[] = [];
	const handlers = new Map<string, Set<(snapshot: PlayerSnapshot) => void>>();
	const source: PlayerSource & {
		calls: string[];
		emitState(partial: Partial<PlayerSnapshot>): void;
	} = {
		calls,
		emitState(partial) {
			snapshot = { ...snapshot, ...partial };
			for (const handler of handlers.get('state') ?? []) handler(snapshot);
		},
		load: async () => {},
		play: () => {
			calls.push('play');
			snapshot = { ...snapshot, status: 'playing' };
		},
		pause: () => {
			calls.push('pause');
			snapshot = { ...snapshot, status: 'paused' };
		},
		seek: (seconds) => {
			calls.push(`seek:${seconds}`);
			snapshot = { ...snapshot, position: seconds };
		},
		setRate: (rate) => {
			calls.push(`rate:${rate}`);
			snapshot = { ...snapshot, rate };
		},
		setVolume: (volume) => {
			calls.push(`volume:${volume}`);
			snapshot = { ...snapshot, volume };
		},
		setMuted: (muted) => {
			calls.push(`muted:${muted}`);
			snapshot = { ...snapshot, muted };
		},
		setCaptions: (captions) => {
			calls.push(`captions:${captions}`);
			snapshot = { ...snapshot, captions };
		},
		setCaptionSize: (size) => {
			calls.push(`captionSize:${size}`);
		},
		getState: () => snapshot,
		on: (event, handler) => {
			const set = handlers.get(event) ?? new Set();
			set.add(handler);
			handlers.set(event, set);
			return () => set.delete(handler);
		},
		capabilities: () => ({
			fullscreen: true,
			pip: false,
			captions: true,
			rates: [0.5, 1, 1.5, 2],
			boost: false,
			qualities: ['Auto']
		}),
		destroy: () => {
			calls.push('destroy');
		}
	};
	return source;
}

function memoryStorage() {
	const map = new Map<string, string>();
	return {
		map,
		storage: {
			get length() {
				return map.size;
			},
			clear: () => map.clear(),
			getItem: (key: string) => map.get(key) ?? null,
			key: (index: number) => [...map.keys()][index] ?? null,
			removeItem: (key: string) => void map.delete(key),
			setItem: (key: string, value: string) => void map.set(key, value)
		} as Storage
	};
}

describe('player controller', () => {
	it('applies prefs to the source, toggles, skips within bounds and clamps rate and volume', () => {
		const source = fakeSource();
		const { storage } = memoryStorage();
		const controller = createController(
			source,
			'abcdefghijk',
			{ ...DEFAULT_PREFS, speed: 1.5, volume: 0.5 },
			storage,
			() => 1000
		);

		controller.applyPrefs();
		expect(source.calls).toEqual([
			'rate:1.5',
			'volume:0.5',
			'muted:false',
			'captions:false',
			'captionSize:medium'
		]);

		source.calls.length = 0;
		controller.applyPrefs({ ...DEFAULT_PREFS, speed: 1.5, volume: 0.5, captionSize: 'large' });
		expect(source.calls).toEqual(['captionSize:large']);

		controller.toggle();
		expect(source.getState().status).toBe('playing');
		controller.toggle();
		expect(source.getState().status).toBe('paused');

		controller.skip(-30);
		expect(source.calls.at(-1)).toBe('seek:0');
		controller.seek(50);
		controller.skip(70);
		expect(source.calls.at(-1)).toBe('seek:100');

		controller.setRate(9);
		expect(source.getState().rate).toBe(2);
		controller.setRate(1.3);
		expect(source.getState().rate).toBe(1.25);
		controller.setVolume(-1);
		expect(source.getState().volume).toBe(0);
		controller.setVolume(0.4);
		expect(source.getState().volume).toBe(0.4);

		controller.toggleMute();
		expect(source.getState().muted).toBe(true);
		controller.toggleCaptions();
		expect(source.getState().captions).toBe(true);
	});

	it('steps the speed through the supported list', () => {
		const source = fakeSource();
		const controller = createController(source, 'abcdefghijk', DEFAULT_PREFS, null, () => 0);

		controller.stepRate(1);
		expect(source.getState().rate).toBe(1.25);
		controller.stepRate(1);
		controller.stepRate(1);
		controller.stepRate(1);
		controller.stepRate(1);
		expect(source.getState().rate).toBe(2);
		controller.stepRate(-1);
		expect(source.getState().rate).toBe(1.75);
	});

	it('persists the position on demand, clears it near the end, and disposes the source', () => {
		const source = fakeSource();
		const { storage, map } = memoryStorage();
		const controller = createController(source, 'abcdefghijk', DEFAULT_PREFS, storage, () => 5000);

		controller.seek(40);
		controller.persistPosition();
		expect(map.get('player:pos:abcdefghijk')).toContain('"position":40');

		controller.seek(95);
		controller.persistPosition();
		expect(map.has('player:pos:abcdefghijk')).toBe(false);

		controller.dispose();
		expect(source.calls.at(-1)).toBe('destroy');
	});

	it('never writes a position when resume is turned off', () => {
		const source = fakeSource();
		const { storage, map } = memoryStorage();
		const controller = createController(
			source,
			'abcdefghijk',
			{ ...DEFAULT_PREFS, resume: false },
			storage,
			() => 5000
		);

		controller.seek(40);
		controller.persistPosition();
		expect(map.size).toBe(0);
	});
});
