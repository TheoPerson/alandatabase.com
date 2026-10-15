import { describe, expect, it } from 'vitest';
import { inertOutside } from './inert';

function element(options: { holds?: unknown; inert?: boolean } = {}) {
	return {
		inert: options.inert ?? false,
		contains(node: unknown) {
			return node !== undefined && node === options.holds;
		}
	};
}

describe('inertOutside', () => {
	it('makes every top-level sibling inert except the one holding the palette', () => {
		const palette = {};
		const app = element();
		const portal = element({ holds: palette });
		const other = element();
		inertOutside({ children: [app, portal, other] }, [palette]);
		expect([app.inert, portal.inert, other.inert]).toEqual([true, false, true]);
	});

	it('restores exactly what it changed', () => {
		const palette = {};
		const app = element();
		const portal = element({ holds: palette });
		const restore = inertOutside({ children: [app, portal] }, [palette]);
		restore();
		expect([app.inert, portal.inert]).toEqual([false, false]);
	});

	it('leaves elements that were already inert as they were', () => {
		const palette = {};
		const already = element({ inert: true });
		const app = element();
		const restore = inertOutside({ children: [already, app, element({ holds: palette })] }, [
			palette
		]);
		restore();
		expect(already.inert).toBe(true);
		expect(app.inert).toBe(false);
	});

	it('is idempotent when restored twice', () => {
		const palette = {};
		const app = element();
		const restore = inertOutside({ children: [app, element({ holds: palette })] }, [palette]);
		restore();
		app.inert = true; // something else made it inert in the meantime
		restore();
		expect(app.inert).toBe(true);
	});

	it('ignores nodes that are not there yet', () => {
		const app = element();
		inertOutside({ children: [app] }, [null, undefined]);
		expect(app.inert).toBe(true);
	});
});
