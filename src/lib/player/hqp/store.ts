// Minimal Svelte-compatible store: subscribe runs synchronously with the current value.
import type { Readable } from './types';

export function writable<T>(
	initial: T
): Readable<T> & { set(value: T): void; update(fn: (value: T) => T): void; get(): T } {
	let value = initial;
	const subscribers = new Set<(value: T) => void>();
	const set = (next: T) => {
		// Same rule as Svelte: objects always notify, equal primitives do not.
		if (next === value && (typeof next !== 'object' || next === null)) return;
		value = next;
		for (const run of [...subscribers]) if (subscribers.has(run)) run(value);
	};
	return {
		subscribe(run) {
			subscribers.add(run);
			run(value);
			return () => void subscribers.delete(run);
		},
		set,
		update: (fn) => set(fn(value)),
		get: () => value
	};
}
