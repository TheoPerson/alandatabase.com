import { error, fail } from '@sveltejs/kit';
import type { PosterItem } from '$lib/catalogue/items';
import { isOwnerUser } from '$lib/server/auth/owner';
import { hasPermission } from '$lib/server/auth/permissions';
import { getLocalShow, type LocalShow } from '$lib/server/hqp/local';
import { logServerError } from '$lib/server/security/logging';
import {
	getShowInteraction,
	isShowFlag,
	setShowFlag,
	type ShowInteractionState
} from '$lib/server/services/show-interaction.service';
import { getTop50IMDbTVShows, type TVShowSummary } from '$lib/server/services/tv.service';
import { getTvShowByTmdbId, type TvShowDetailView } from '$lib/server/services/tv-db.service';
import type { Actions, PageServerLoad } from './$types';

const SIMILAR_LIMIT = 12;

export interface SeriesEpisode {
	seasonNumber: number;
	episodeNumber: number;
	name: string | null;
	overview: string | null;
	stillPath: string | null;
	airDate: string | null;
	runtime: number | null;
}

export interface SeriesSeason {
	seasonNumber: number;
	name: string | null;
	airDate: string | null;
	episodeCount: number | null;
	episodes: SeriesEpisode[];
}

function yearOf(date: string | null | undefined): string | null {
	return /^(\d{4})/u.exec(date ?? '')?.[1] ?? null;
}

// "2016–2025" for an ended show, "2016–" while it runs, "2016" for a single year.
function yearsLabel(show: TvShowDetailView): string | null {
	const first = yearOf(show.firstAirDate);
	if (!first) return null;
	const last = yearOf(show.lastAirDate);
	const running = show.status === 'Returning Series' || show.status === 'In Production';
	if (running) return `${first}–`;
	return last && last !== first ? `${first}–${last}` : first;
}

// Regular seasons in order, specials last; seasons the catalogue has no episode of are left out.
function toSeasons(show: TvShowDetailView | null): SeriesSeason[] {
	if (!show) return [];
	return show.seasons
		.filter((season) => season.episodes.length > 0)
		.sort(
			(a, b) =>
				Number(a.seasonNumber === 0) - Number(b.seasonNumber === 0) ||
				a.seasonNumber - b.seasonNumber
		)
		.map((season) => ({
			seasonNumber: season.seasonNumber,
			name: season.name,
			airDate: season.airDate,
			episodeCount: season.episodeCount,
			episodes: season.episodes.map((episode) => ({
				seasonNumber: episode.seasonNumber,
				episodeNumber: episode.episodeNumber,
				name: episode.name,
				overview: episode.overview,
				stillPath: episode.stillPath,
				airDate: episode.airDate,
				runtime: episode.runtime
			}))
		}));
}

function toChartPoster(show: TVShowSummary): PosterItem {
	return {
		id: `tv-${show.tmdbId}`,
		href: `/tv/${show.tmdbId}`,
		title: show.title,
		posterPath: show.posterPath,
		releaseDate: show.firstAirDate,
		rating: show.imdbRating,
		genre: show.genres[0] ?? null,
		ratingSource: 'IMDb'
	};
}

/**
 * A series page reads the catalogue database first (seasons and episodes, kept by the TV ingest)
 * and the committed IMDb Top TV snapshot (chart rank and IMDb rating). Either one is enough to
 * show the page. The owner also gets the episodes that are on this PC (Alan's HQP); nobody else's
 * load touches the media library.
 */
export const load = (async ({ params, locals }) => {
	if (!/^\d{1,9}$/u.test(params.id)) throw error(404, 'Series not found');
	const tmdbId = Number(params.id);
	const user = hasPermission(locals.user, 'account:access') ? locals.user : null;
	const owner = user && isOwnerUser(user) ? user : null;

	const shows = await getTop50IMDbTVShows();
	const chart = shows.find((candidate) => candidate.tmdbId === tmdbId) ?? null;

	let stored: TvShowDetailView | null = null;
	try {
		stored = await getTvShowByTmdbId(tmdbId);
	} catch (err) {
		logServerError('Series detail read failed', err);
		// The chart alone still makes a page; without it there is nothing honest to show.
		if (!chart) throw error(500, 'Failed to load series details');
	}
	if (!chart && !stored) throw error(404, 'Series not found');

	const seasons = toSeasons(stored);
	let local: LocalShow | null = null;
	if (owner && seasons.length > 0) {
		try {
			local = await getLocalShow(
				owner.id,
				(stored?.seasons ?? []).flatMap((season) => season.episodes)
			);
		} catch (err) {
			logServerError('Series local files read failed', err);
		}
	}

	let interaction: ShowInteractionState | null = null;
	if (user) {
		try {
			interaction = await getShowInteraction(user.id, tmdbId);
		} catch (err) {
			logServerError('Series interaction read failed', err);
		}
	}

	const genres = chart?.genres ?? stored?.genres ?? [];
	const genreSet = new Set(genres);
	const similar: PosterItem[] = shows
		.filter((other) => other.tmdbId !== tmdbId)
		.map((other) => ({ other, shared: other.genres.filter((genre) => genreSet.has(genre)).length }))
		.filter(({ shared }) => shared > 0)
		.sort((a, b) => b.shared - a.shared || a.other.rank - b.other.rank)
		.slice(0, SIMILAR_LIMIT)
		.map(({ other }) => toChartPoster(other));

	const tmdbRating =
		stored?.voteAverage && stored.voteAverage > 0 && (stored.voteCount ?? 0) > 0
			? stored.voteAverage
			: null;

	return {
		show: {
			tmdbId,
			imdbId: chart?.imdbId ?? stored?.imdbId ?? null,
			title: chart?.title ?? stored?.name ?? 'Series',
			rank: chart?.rank ?? null,
			rating: chart?.imdbRating ?? tmdbRating,
			ratingSource: chart ? 'IMDb' : tmdbRating !== null ? 'TMDB' : null,
			years: chart?.year ?? (stored ? yearsLabel(stored) : null),
			firstYear: yearOf(chart?.firstAirDate) ?? yearOf(stored?.firstAirDate),
			firstAirDate: stored?.firstAirDate ?? chart?.firstAirDate ?? null,
			seasons: stored?.numberOfSeasons ?? chart?.seasonsCount ?? null,
			episodes: stored?.numberOfEpisodes ?? chart?.episodesCount ?? null,
			status: stored?.status ?? chart?.status ?? null,
			posterPath: chart?.posterPath ?? stored?.posterPath ?? null,
			backdropPath: chart?.backdropPath ?? stored?.backdropPath ?? null,
			overview: chart?.overview || stored?.overview || null,
			tagline: stored?.tagline ?? null,
			genres
		},
		seasons,
		local,
		similar,
		signedIn: user !== null,
		interaction
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	// One field per submit: watchlist | favorite as 'true'/'false'.
	logInteraction: async ({ request, locals, params }) => {
		if (!locals.user) return fail(401, { error: 'Sign in to save series.' });
		if (!hasPermission(locals.user, 'account:access')) {
			return fail(403, { error: 'Saving series needs a signed-in account.' });
		}
		if (!/^\d{1,9}$/u.test(params.id)) return fail(404, { error: 'Series not found.' });
		const tmdbId = Number(params.id);

		const data = await request.formData();
		const type = data.get('type')?.toString();
		const value = data.get('value')?.toString();
		if (!isShowFlag(type)) return fail(400, { error: 'Unknown interaction type.' });
		if (value !== 'true' && value !== 'false') {
			return fail(400, { error: 'Interaction value must be true or false.' });
		}

		try {
			// Only a series a standard page can show may be saved (chart or standard row).
			const onChart = (await getTop50IMDbTVShows()).some((show) => show.tmdbId === tmdbId);
			if (!onChart && !(await getTvShowByTmdbId(tmdbId))) {
				return fail(404, { error: 'Series not found.' });
			}
			const interaction = await setShowFlag(locals.user.id, tmdbId, type, value === 'true');
			return { success: true, interaction };
		} catch (err) {
			logServerError('Series interaction update failed', err);
			return fail(500, { error: 'Failed to update interaction.' });
		}
	}
};
