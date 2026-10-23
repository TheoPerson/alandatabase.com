import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userLists } from '$lib/server/db/schema';
import { logServerError } from '$lib/server/security/logging';
import { parseListInput } from '$lib/server/security/list-input';
import { listPrefill } from '$lib/components/lists/list-form';

export async function load({ locals, url }) {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}
	// The Lists starters link here with ?name=…&description=… to prefill the form.
	return { prefill: listPrefill(url.searchParams) };
}

export const actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const parsed = parseListInput(
			formData.get('name')?.toString(),
			formData.get('description')?.toString()
		);
		const isPublic = formData.get('isPublic') === 'on';

		if (!parsed.ok) {
			return fail(400, { error: parsed.error });
		}
		const { name, description } = parsed.value;

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
			logServerError('List creation failed', err);
			return fail(500, { error: 'Failed to create list' });
		}
	}
};
