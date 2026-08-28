import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/services/movie.service', () => ({ getMovieById: vi.fn() }));
vi.mock('$lib/server/services/interaction.service', () => ({ logActivity: vi.fn() }));

import { _parseInteractionUpdate, actions } from './+page.server';

describe('catalog interaction validation', () => {
	it('accepts exact booleans and supported ratings', () => {
		expect(_parseInteractionUpdate('watched', 'true')).toMatchObject({ ok: true, value: true });
		expect(_parseInteractionUpdate('favorite', 'false')).toMatchObject({ ok: true, value: false });
		expect(_parseInteractionUpdate('rating', '0.5')).toMatchObject({ ok: true, value: 0.5 });
		expect(_parseInteractionUpdate('rating', '5')).toMatchObject({ ok: true, value: 5 });
		expect(_parseInteractionUpdate('rating', '')).toMatchObject({ ok: true, value: null });
	});

	it.each([
		['unknown', 'true'],
		['watched', 'yes'],
		['rating', 'NaN'],
		['rating', '0'],
		['rating', '-1'],
		['rating', '5.5'],
		['rating', '4.2']
	])('rejects type %s with value %s', (type, value) => {
		expect(_parseInteractionUpdate(type, value)).toMatchObject({ ok: false });
	});

	it.each(['admin', 'member'])('denies %s personal interaction and list actions', async (role) => {
		const formData = vi.fn();
		const locals = { user: { id: 'user-id', role } };

		const interactionResult = await actions.logInteraction({
			locals,
			request: { formData }
		} as any);
		const listResult = await actions.toggleList({
			locals,
			request: { formData }
		} as any);

		expect(interactionResult).toMatchObject({ status: 403 });
		expect(listResult).toMatchObject({ status: 403 });
		expect(formData).not.toHaveBeenCalled();
	});
});
