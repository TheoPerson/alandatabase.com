import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userLists } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { prepareStandardMovie } from '$lib/server/services/movie.service';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const lists = await db.query.userLists.findMany({
		where: eq(userLists.userId, locals.user.id),
		orderBy: [desc(userLists.createdAt)],
		with: {
			items: {
				limit: 4, // Get top 4 movies for thumbnails
				orderBy: (items, { asc }) => [asc(items.position)],
				with: {
					movie: {
						with: { keywords: true }
					}
				}
			}
		}
	});

	return {
		lists: lists.map((list) => ({
			...list,
			items: list.items
				.map((item) => {
					const movie = prepareStandardMovie(item.movie);
					return movie ? { ...item, movie } : null;
				})
				.filter((item): item is NonNullable<typeof item> => item !== null)
		}))
	};
}
