import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userLists, userListItems } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { prepareStandardMovie } from '$lib/server/services/movie.service';

export async function load({ params, locals }) {
	const listId = params.listId;

	const list = await db.query.userLists.findFirst({
		where: eq(userLists.id, listId),
		with: {
			items: {
				orderBy: (items, { asc }) => [asc(items.position)],
				with: {
					movie: {
						with: { keywords: true }
					}
				}
			},
			user: {
				columns: {
					id: true,
					username: true,
					displayName: true
				}
			}
		}
	});

	if (!list) {
		throw error(404, 'List not found');
	}

	const isOwner = locals.user && locals.user.id === list.userId;

	if (!list.isPublic && !isOwner) {
		throw error(403, 'This list is private');
	}

	return {
		list: {
			...list,
			items: list.items
				.map((item) => {
					const movie = prepareStandardMovie(item.movie);
					return movie ? { ...item, movie } : null;
				})
				.filter((item): item is NonNullable<typeof item> => item !== null)
		},
		isOwner
	};
}

export const actions = {
	removeItem: async ({ request, locals, params }) => {
		if (!locals.user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const movieId = formData.get('movieId')?.toString();
		if (!movieId) return fail(400, { error: 'Missing movieId' });

		const list = await db.query.userLists.findFirst({ where: eq(userLists.id, params.listId) });
		if (!list || list.userId !== locals.user.id) {
			return fail(403, { error: 'Forbidden' });
		}

		await db
			.delete(userListItems)
			.where(and(eq(userListItems.listId, params.listId), eq(userListItems.movieId, movieId)));

		return { success: true };
	},

	deleteList: async ({ locals, params }) => {
		if (!locals.user) return fail(401, { error: 'Unauthorized' });

		const list = await db.query.userLists.findFirst({ where: eq(userLists.id, params.listId) });
		if (!list || list.userId !== locals.user.id) {
			return fail(403, { error: 'Forbidden' });
		}

		await db.delete(userLists).where(eq(userLists.id, params.listId));
		throw redirect(302, '/my/lists');
	}
};
