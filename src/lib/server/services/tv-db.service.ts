import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { tvEpisodes, tvSeasons, tvShows } from '../db/schema';
import { isStandardTvShow, standardTvShowVisibilityWhere } from '../policies/tv-visibility';
import { MAX_SEARCH_QUERY_LENGTH } from '../security/request-bounds';

/**
 * Database-backed TV catalogue reads (docs/TV_DB_BACKING_SPEC.md). Every read goes through the
 * shared standard-content predicate, then through {@link prepareStandardTvShow} in memory, so a
 * TMDB-adult, custom or explicitly tagged show is unreachable from browse, search and detail.
 * Unknown dates and counts stay null: nothing here synthesises precision the database lacks.
 */

export const MAX_TV_PAGE_SIZE = 60;
const MAX_TV_SEARCH_RESULTS = 30;
const MAX_TV_LOOKUP_IDS = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// Only text fields an editor may correct. Counts and other numbers are never overridable, so an
// override can never invent a season or episode count.
const OVERRIDABLE_TEXT_FIELDS = ['name', 'originalName', 'overview', 'tagline', 'firstAirDate'];

export interface TvEpisodeView {
	id: string;
	seasonNumber: number;
	episodeNumber: number;
	name: string | null;
	overview: string | null;
	stillPath: string | null;
	airDate: string | null;
	runtime: number | null;
	voteAverage: number | null;
}

export interface TvSeasonView {
	id: string;
	seasonNumber: number;
	name: string | null;
	overview: string | null;
	posterPath: string | null;
	airDate: string | null;
	episodeCount: number | null;
	episodes: TvEpisodeView[];
}

export interface TvShowSummaryView {
	id: string;
	tmdbId: number;
	name: string;
	originalName: string | null;
	overview: string | null;
	tagline: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	firstAirDate: string | null;
	lastAirDate: string | null;
	status: string | null;
	numberOfSeasons: number | null;
	numberOfEpisodes: number | null;
	voteAverage: number | null;
	voteCount: number | null;
	popularity: number | null;
	originalLanguage: string | null;
	imdbId: string | null;
	genres: string[];
}

export interface TvShowDetailView extends TvShowSummaryView {
	seasons: TvSeasonView[];
}

type Row = Record<string, unknown>;

function applyStoredTvOverrides(show: Row): Row {
	const resolved: Row = { ...show };
	const overrides = show.localOverrides;
	if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
		for (const field of OVERRIDABLE_TEXT_FIELDS) {
			const value = (overrides as Row)[field];
			if (typeof value === 'string' && value.length > 0) resolved[field] = value;
		}
	}
	delete resolved.localOverrides;
	return resolved;
}

/**
 * Mirror of prepareStandardMovie: null unless the show is standard content (keywords must be
 * loaded), then keywords are stripped and text overrides applied.
 */
export function prepareStandardTvShow(show: unknown): Row | null {
	if (!isStandardTvShow(show)) return null;
	const visible: Row = { ...(show as unknown as Row) };
	delete visible.keywords;
	return applyStoredTvOverrides(visible);
}

function text(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function integer(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function decimal(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function genreNames(show: Row): string[] {
	const relations = Array.isArray(show.genres) ? (show.genres as Row[]) : [];
	return relations
		.map((relation) => (relation.genre as Row | undefined)?.name)
		.filter((name): name is string => typeof name === 'string' && name.length > 0);
}

function toSummary(show: Row): TvShowSummaryView {
	return {
		id: String(show.id),
		tmdbId: Number(show.tmdbId),
		name: String(show.name),
		originalName: text(show.originalName),
		overview: text(show.overview),
		tagline: text(show.tagline),
		posterPath: text(show.posterPath),
		backdropPath: text(show.backdropPath),
		firstAirDate: text(show.firstAirDate),
		lastAirDate: text(show.lastAirDate),
		status: text(show.status),
		numberOfSeasons: integer(show.numberOfSeasons),
		numberOfEpisodes: integer(show.numberOfEpisodes),
		voteAverage: decimal(show.voteAverage),
		voteCount: integer(show.voteCount),
		popularity: decimal(show.popularity),
		originalLanguage: text(show.originalLanguage),
		imdbId: text(show.imdbId),
		genres: genreNames(show)
	};
}

function toEpisode(episode: Row): TvEpisodeView {
	return {
		id: String(episode.id),
		seasonNumber: Number(episode.seasonNumber),
		episodeNumber: Number(episode.episodeNumber),
		name: text(episode.name),
		overview: text(episode.overview),
		stillPath: text(episode.stillPath),
		airDate: text(episode.airDate),
		runtime: integer(episode.runtime),
		voteAverage: decimal(episode.voteAverage)
	};
}

function toSeason(season: Row): TvSeasonView {
	const episodes = Array.isArray(season.episodes) ? (season.episodes as Row[]) : [];
	return {
		id: String(season.id),
		seasonNumber: Number(season.seasonNumber),
		name: text(season.name),
		overview: text(season.overview),
		posterPath: text(season.posterPath),
		airDate: text(season.airDate),
		episodeCount: integer(season.episodeCount),
		episodes: episodes.map(toEpisode)
	};
}

// Literal `true` flags with mutable orderBy arrays: Drizzle's relational config rejects the
// readonly tuples an `as const` object would produce.
const detailRelations = {
	keywords: true as const,
	genres: { with: { genre: true as const } },
	seasons: {
		orderBy: [asc(tvSeasons.seasonNumber)],
		with: { episodes: { orderBy: [asc(tvEpisodes.episodeNumber)] } }
	}
};

const summaryRelations = {
	keywords: true,
	genres: { with: { genre: true } }
} as const;

function toDetail(row: unknown): TvShowDetailView | null {
	const prepared = prepareStandardTvShow(row);
	if (!prepared) return null;
	const seasons = Array.isArray(prepared.seasons) ? (prepared.seasons as Row[]) : [];
	return { ...toSummary(prepared), seasons: seasons.map(toSeason) };
}

function toSummaries(rows: unknown[]): TvShowSummaryView[] {
	const summaries: TvShowSummaryView[] = [];
	for (const row of rows) {
		const prepared = prepareStandardTvShow(row);
		if (prepared) summaries.push(toSummary(prepared));
	}
	return summaries;
}

/** One standard show with its seasons and episodes (ordered), or null when unknown/quarantined. */
export async function getTvShowByTmdbId(tmdbId: number): Promise<TvShowDetailView | null> {
	if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return null;
	const row = await db.query.tvShows.findFirst({
		where: and(eq(tvShows.tmdbId, tmdbId), standardTvShowVisibilityWhere()),
		with: detailRelations
	});
	return toDetail(row);
}

/** Same as {@link getTvShowByTmdbId}, addressed by the row id (uuid). */
export async function getTvShowById(id: string): Promise<TvShowDetailView | null> {
	if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null;
	const row = await db.query.tvShows.findFirst({
		where: and(eq(tvShows.id, id), standardTvShowVisibilityWhere()),
		with: detailRelations
	});
	return toDetail(row);
}

function boundedLimit(limit: number, max: number): number {
	return Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), max) : 1;
}

function boundedOffset(offset: number): number {
	return Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
}

/** A bounded page of standard shows, most popular first. */
export async function listTvShows(limit = 24, offset = 0): Promise<TvShowSummaryView[]> {
	const rows = await db.query.tvShows.findMany({
		where: standardTvShowVisibilityWhere(),
		orderBy: [sql`${tvShows.popularity} desc nulls last`, desc(tvShows.id)],
		limit: boundedLimit(limit, MAX_TV_PAGE_SIZE),
		offset: boundedOffset(offset),
		with: summaryRelations
	});
	return toSummaries(rows);
}

/** Standard shows among the given TMDB ids (any order; unknown or quarantined ids are left out). */
export async function listTvShowsByTmdbIds(tmdbIds: number[]): Promise<TvShowSummaryView[]> {
	const ids = [...new Set(tmdbIds.filter((id) => Number.isSafeInteger(id) && id > 0))].slice(
		0,
		MAX_TV_LOOKUP_IDS
	);
	if (ids.length === 0) return [];
	const rows = await db.query.tvShows.findMany({
		where: and(inArray(tvShows.tmdbId, ids), standardTvShowVisibilityWhere()),
		with: summaryRelations
	});
	return toSummaries(rows);
}

function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/gu, '\\$&');
}

/** Bounded title search over standard shows (name, original name, overridden name). */
export async function searchTvShows(query: string, limit = 10): Promise<TvShowSummaryView[]> {
	const normalized = typeof query === 'string' ? query.trim() : '';
	if (!normalized || normalized.length > MAX_SEARCH_QUERY_LENGTH) return [];
	const pattern = `%${escapeLikePattern(normalized)}%`;

	const rows = await db.query.tvShows.findMany({
		where: and(
			standardTvShowVisibilityWhere(),
			or(
				ilike(tvShows.name, pattern),
				ilike(tvShows.originalName, pattern),
				ilike(sql`${tvShows.localOverrides}->>'name'`, pattern)
			)
		),
		orderBy: [sql`${tvShows.popularity} desc nulls last`, desc(tvShows.id)],
		limit: boundedLimit(limit, MAX_TV_SEARCH_RESULTS),
		with: summaryRelations
	});
	return toSummaries(rows);
}
