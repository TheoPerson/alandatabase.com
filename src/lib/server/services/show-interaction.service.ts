import { and, desc, eq } from 'drizzle-orm';
import type { PosterItem } from '$lib/catalogue/items';
import { db } from '../db/index.js';
import { userShowInteractions } from '../db/schema.js';
import { getTop50IMDbTVShows } from './tv.service.js';
import { listTvShowsByTmdbIds } from './tv-db.service.js';

/**
 * A user's watchlist and favourite flags for series, keyed by TMDB id. A series is listed only
 * while a standard surface can show it: the IMDb Top TV snapshot or a standard tv_shows row
 * (quarantined shows never resolve, so their flags stay invisible).
 */

export type ShowFlag = 'watchlist' | 'favorite';

export interface ShowInteractionState {
	watchlist: boolean;
	favorite: boolean;
}

const EMPTY: ShowInteractionState = { watchlist: false, favorite: false };

// Same bound as the film lists: one page never scans a lifetime of flags.
const MAX_SHOW_ITEMS = 500;

export function isShowFlag(value: string | undefined): value is ShowFlag {
	return value === 'watchlist' || value === 'favorite';
}

export async function getShowInteraction(
	userId: string,
	tmdbId: number
): Promise<ShowInteractionState> {
	const [row] = await db
		.select({
			watchlist: userShowInteractions.watchlist,
			favorite: userShowInteractions.favorite
		})
		.from(userShowInteractions)
		.where(and(eq(userShowInteractions.userId, userId), eq(userShowInteractions.tmdbId, tmdbId)))
		.limit(1);
	return row ?? EMPTY;
}

/** One atomic upsert; returns the saved state. The caller checks the series exists first. */
export async function setShowFlag(
	userId: string,
	tmdbId: number,
	flag: ShowFlag,
	value: boolean
): Promise<ShowInteractionState> {
	const updatedAt = new Date();
	const [row] = await db
		.insert(userShowInteractions)
		.values({ userId, tmdbId, [flag]: value, updatedAt })
		.onConflictDoUpdate({
			target: [userShowInteractions.userId, userShowInteractions.tmdbId],
			set: { [flag]: value, updatedAt }
		})
		.returning({
			watchlist: userShowInteractions.watchlist,
			favorite: userShowInteractions.favorite
		});
	return row ?? EMPTY;
}

/** Series posters for one flag, most recently changed first. */
export async function listShowPosters(userId: string, flag: ShowFlag): Promise<PosterItem[]> {
	const rows = await db
		.select({ tmdbId: userShowInteractions.tmdbId })
		.from(userShowInteractions)
		.where(and(eq(userShowInteractions.userId, userId), eq(userShowInteractions[flag], true)))
		.orderBy(desc(userShowInteractions.updatedAt))
		.limit(MAX_SHOW_ITEMS);
	if (rows.length === 0) return [];

	const ids = rows.map((row) => row.tmdbId);
	const [chart, stored] = await Promise.all([getTop50IMDbTVShows(), listTvShowsByTmdbIds(ids)]);
	const chartById = new Map(chart.map((show) => [show.tmdbId, show]));
	const storedById = new Map(stored.map((show) => [show.tmdbId, show]));

	return ids.flatMap((tmdbId): PosterItem[] => {
		const fromChart = chartById.get(tmdbId);
		if (fromChart) {
			return [
				{
					id: `tv-${tmdbId}`,
					href: `/tv/${tmdbId}`,
					title: fromChart.title,
					posterPath: fromChart.posterPath,
					releaseDate: fromChart.firstAirDate,
					rating: fromChart.imdbRating,
					genre: fromChart.genres[0] ?? null,
					ratingSource: 'IMDb'
				}
			];
		}
		const show = storedById.get(tmdbId);
		if (!show) return [];
		const rated = show.voteAverage && show.voteAverage > 0 && (show.voteCount ?? 0) > 0;
		return [
			{
				id: `tv-${tmdbId}`,
				href: `/tv/${tmdbId}`,
				title: show.name,
				posterPath: show.posterPath,
				releaseDate: show.firstAirDate,
				rating: rated ? show.voteAverage : null,
				genre: show.genres[0] ?? null
			}
		];
	});
}
