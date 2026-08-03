import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function load({ locals }) {
	if (!locals.user) throw redirect(302, '/auth/login');

	const diary = await db.query.activities.findMany({
		where: eq(activities.userId, locals.user.id),
		orderBy: [desc(activities.createdAt)],
		with: {
			movie: {
				columns: {
					id: true,
					title: true,
					posterPath: true,
					releaseDate: true,
					voteAverage: true
				}
			}
		},
		limit: 100
	});

	return { diary, user: locals.user };
}
