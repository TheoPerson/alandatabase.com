import { describe, expect, it } from 'vitest';
import { writable } from './store';

describe('writable', () => {
	it('calls a new subscriber synchronously with the current value', () => {
		const store = writable(1);
		const seen: number[] = [];
		store.subscribe((v) => seen.push(v));
		expect(seen).toEqual([1]);
	});

	it('notifies on set and update, skips equal primitives, always emits objects', () => {
		const store = writable(1);
		const seen: number[] = [];
		store.subscribe((v) => seen.push(v));
		store.set(2);
		store.set(2);
		store.update((v) => v + 1);
		expect(seen).toEqual([1, 2, 3]);
		expect(store.get()).toBe(3);

		const obj = writable({ a: 1 });
		let count = 0;
		obj.subscribe(() => count++);
		obj.set(obj.get());
		expect(count).toBe(2);
	});

	it('stops notifying after unsubscribe, even during a notification', () => {
		const store = writable('a');
		const seen: string[] = [];
		const stopA = store.subscribe((v) => {
			seen.push(`a:${v}`);
			if (v === 'b') stopB();
		});
		const stopB = store.subscribe((v) => seen.push(`b:${v}`));
		store.set('b');
		store.set('c');
		stopA();
		store.set('d');
		expect(seen).toEqual(['a:a', 'b:a', 'a:b', 'a:c']);
	});
});
