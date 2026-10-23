import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userLists } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { prepareStandardMovie } from '$lib/server/services/movie.service';
import { getUserWatchlist } from '$lib/server/services/interaction.service';
import { logServerError } from '$lib/server/security/logging';

const FAN_SIZE = 5;

// The empty state shows a few posters from the viewer's own watchlist (standard catalogue
// only, as the service already filters). A failure just leaves the fan out.
async function watchlistFan(userId: string) {
	try {
		const rows = await getUserWatchlist(userId);
		return rows
			.map((row) => row.movie)
			.filter((movie) => movie?.posterPath)
			.slice(0, FAN_SIZE)
			.map((movie) => ({
				id: String(movie.id),
				title: String(movie.title),
				posterPath: String(movie.posterPath)
			}));
	} catch (err) {
		logServerError('Lists poster fan failed', err);
		return [];
	}
}

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
		fan: lists.length === 0 ? await watchlistFan(locals.user.id) : [],
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
