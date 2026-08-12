import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userLists } from '$lib/server/db/schema';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}
	return {};
}

export const actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const name = formData.get('name')?.toString();
		const description = formData.get('description')?.toString();
		const isPublic = formData.get('isPublic') === 'on';

		if (!name || name.trim() === '') {
			return fail(400, { error: 'List name is required' });
		}

		try {
			const [newList] = await db
				.insert(userLists)
				.values({
					userId: locals.user.id,
					name,
					description,
					isPublic
				})
				.returning();

			return { success: true, listId: newList.id };
		} catch (err) {
			console.error('Failed to create list:', err);
			return fail(500, { error: 'Failed to create list' });
		}
	}
};
