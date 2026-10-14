import { beforeEach, describe, expect, it, vi } from 'vitest';

const { insert, findFirst, remove } = vi.hoisted(() => ({
	insert: vi.fn(),
	findFirst: vi.fn(),
	remove: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
	db: {
		insert: () => ({ values: (v: unknown) => ({ returning: () => insert(v) }) }),
		delete: () => ({ where: (w: unknown) => remove(w) }),
		query: { userLists: { findFirst } }
	}
}));
vi.mock('$lib/server/services/movie.service', () => ({ prepareStandardMovie: (m: unknown) => m }));

import { actions as createActions } from './create/+page.server';
import { actions as listActions, load as listLoad } from './[listId]/+page.server';

const user = { id: 'user-1', role: 'owner' };
const form = (fields: Record<string, string>) => ({
	formData: async () => ({ get: (key: string) => fields[key] ?? null })
});
const goodId = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
	vi.clearAllMocks();
	insert.mockResolvedValue([{ id: goodId }]);
});

describe('create list', () => {
	it('trims the name and stores an empty description as null', async () => {
		const result = await createActions.default({
			request: form({ name: '  Weekend  ', description: '   ' }),
			locals: { user }
		} as never);
		expect(result).toMatchObject({ success: true, listId: goodId });
		expect(insert).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Weekend', description: null, userId: 'user-1' })
		);
	});

	it('rejects an over-long name with a 400 instead of a database error', async () => {
		const result = await createActions.default({
			request: form({ name: 'x'.repeat(500) }),
			locals: { user }
		} as never);
		expect(result).toMatchObject({ status: 400 });
		expect(insert).not.toHaveBeenCalled();
	});

	it('requires a session', async () => {
		const result = await createActions.default({
			request: form({ name: 'x' }),
			locals: { user: null }
		} as never);
		expect(result).toMatchObject({ status: 401 });
	});
});

describe('list identifiers', () => {
	it('returns 404 for a malformed list id without querying the database', async () => {
		await expect(
			listLoad({ params: { listId: 'nope' }, locals: { user } } as never)
		).rejects.toMatchObject({
			status: 404
		});
		expect(findFirst).not.toHaveBeenCalled();
	});

	it('refuses to delete with a malformed list id', async () => {
		const result = await listActions.deleteList({
			params: { listId: "x'; drop table user_lists" },
			locals: { user }
		} as never);
		expect(result).toMatchObject({ status: 404 });
		expect(remove).not.toHaveBeenCalled();
	});

	it('refuses to remove an item with a malformed movie id', async () => {
		const result = await listActions.removeItem({
			params: { listId: goodId },
			request: form({ movieId: 'nope' }),
			locals: { user }
		} as never);
		expect(result).toMatchObject({ status: 400 });
		expect(findFirst).not.toHaveBeenCalled();
	});

	it("does not let one member delete another member's list", async () => {
		findFirst.mockResolvedValue({ id: goodId, userId: 'someone-else' });
		const result = await listActions.deleteList({
			params: { listId: goodId },
			locals: { user }
		} as never);
		expect(result).toMatchObject({ status: 403 });
		expect(remove).not.toHaveBeenCalled();
	});
});
