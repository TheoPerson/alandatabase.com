import {
	pgTable,
	uuid,
	varchar,
	text,
	integer,
	bigint,
	decimal,
	boolean,
	date,
	timestamp,
	smallint,
	jsonb,
	real,
	primaryKey,
	index,
	uniqueIndex,
	check
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import type { AudioTrack, ParsedName, SubtitleTrack, VideoInfo } from '../../media/types.js';

// -----------------------------------------------------------------------------
// 1. MOVIES & COLLECTIONS
// -----------------------------------------------------------------------------

export const collections = pgTable('collections', {
	id: uuid('id').defaultRandom().primaryKey(),
	tmdbId: integer('tmdb_id').notNull().unique(),
	name: varchar('name', { length: 500 }).notNull(),
	overview: text('overview'),
	posterPath: varchar('poster_path', { length: 255 }),
	backdropPath: varchar('backdrop_path', { length: 255 }),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const movies = pgTable(
	'movies',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		tmdbId: integer('tmdb_id').notNull().unique(),
		imdbId: varchar('imdb_id', { length: 20 }),
		title: varchar('title', { length: 500 }).notNull(),
		originalTitle: varchar('original_title', { length: 500 }),
		originalLanguage: varchar('original_language', { length: 10 }),
		overview: text('overview'),
		tagline: text('tagline'),
		posterPath: varchar('poster_path', { length: 255 }),
		backdropPath: varchar('backdrop_path', { length: 255 }),
		releaseDate: date('release_date'),
		runtime: integer('runtime'),
		status: varchar('status', { length: 50 }),
		budget: bigint('budget', { mode: 'number' }),
		revenue: bigint('revenue', { mode: 'number' }),
		popularity: decimal('popularity', { precision: 10, scale: 3 }),
		voteAverage: decimal('vote_average', { precision: 4, scale: 2 }),
		voteCount: integer('vote_count'),
		adult: boolean('adult').default(false).notNull(),
		imdbRating: decimal('imdb_rating', { precision: 3, scale: 1 }),
		imdbVoteCount: integer('imdb_vote_count'),
		imdbRatingUpdatedAt: timestamp('imdb_rating_updated_at'),
		collectionId: uuid('collection_id').references(() => collections.id, { onDelete: 'set null' }),
		metadata: jsonb('metadata'),
		localOverrides: jsonb('local_overrides'),
		isLocked: boolean('is_locked').default(false).notNull(),
		syncedAt: timestamp('synced_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('idx_movies_tmdb_id').on(table.tmdbId),
		index('idx_movies_release_date').on(table.releaseDate),
		index('idx_movies_popularity').on(table.popularity),
		index('idx_movies_vote_average').on(table.voteAverage)
	]
);

// -----------------------------------------------------------------------------
// 2. PEOPLE (Actors, Directors, Crew)
// -----------------------------------------------------------------------------

export const people = pgTable(
	'people',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		tmdbId: integer('tmdb_id').notNull().unique(),
		imdbId: varchar('imdb_id', { length: 20 }),
		name: varchar('name', { length: 500 }).notNull(),
		alsoKnownAs: text('also_known_as').array(),
		biography: text('biography'),
		birthday: date('birthday'),
		deathday: date('deathday'),
		placeOfBirth: varchar('place_of_birth', { length: 500 }),
		profilePath: varchar('profile_path', { length: 255 }),
		popularity: decimal('popularity', { precision: 10, scale: 3 }),
		gender: smallint('gender'),
		knownForDepartment: varchar('known_for_department', { length: 100 }),
		syncedAt: timestamp('synced_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [index('idx_people_tmdb_id').on(table.tmdbId)]
);

// -----------------------------------------------------------------------------
// 3. TAXONOMIES & METADATA (Genres, Keywords, Companies, Videos)
// -----------------------------------------------------------------------------

export const genres = pgTable('genres', {
	id: integer('id').primaryKey(), // TMDB genre ID
	name: varchar('name', { length: 100 }).notNull()
});

export const movieGenres = pgTable(
	'movie_genres',
	{
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		genreId: integer('genre_id')
			.notNull()
			.references(() => genres.id, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.movieId, table.genreId] })]
);

export const keywords = pgTable('keywords', {
	id: integer('id').primaryKey(), // TMDB keyword ID
	name: varchar('name', { length: 200 }).notNull()
});

export const movieKeywords = pgTable(
	'movie_keywords',
	{
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		keywordId: integer('keyword_id')
			.notNull()
			.references(() => keywords.id, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.movieId, table.keywordId] })]
);

export const productionCompanies = pgTable('production_companies', {
	id: integer('id').primaryKey(), // TMDB company ID
	name: varchar('name', { length: 500 }).notNull(),
	logoPath: varchar('logo_path', { length: 255 }),
	originCountry: varchar('origin_country', { length: 10 })
});

export const movieProductionCompanies = pgTable(
	'movie_production_companies',
	{
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		companyId: integer('company_id')
			.notNull()
			.references(() => productionCompanies.id, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.movieId, table.companyId] })]
);

export const movieVideos = pgTable(
	'movie_videos',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		key: varchar('key', { length: 100 }).notNull(),
		site: varchar('site', { length: 50 }).notNull(),
		type: varchar('type', { length: 50 }).notNull(),
		name: varchar('name', { length: 500 }),
		official: boolean('official').default(false),
		publishedAt: timestamp('published_at')
	},
	(table) => [uniqueIndex('idx_movie_videos_unique').on(table.movieId, table.key)]
);

export const WATCH_PROVIDER_KINDS = ['flatrate', 'free', 'ads', 'rent', 'buy'] as const;
export type WatchProviderKind = (typeof WATCH_PROVIDER_KINDS)[number];

// Where a title can be watched legally, per region, from TMDB's JustWatch feed.
export const movieWatchProviders = pgTable(
	'movie_watch_providers',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		region: varchar('region', { length: 2 }).notNull(),
		kind: varchar('kind', { length: 10 }).notNull(),
		providerId: integer('provider_id').notNull(),
		providerName: varchar('provider_name', { length: 200 }).notNull(),
		logoPath: varchar('logo_path', { length: 255 }),
		displayPriority: integer('display_priority').default(0).notNull(),
		link: text('link'),
		syncedAt: timestamp('synced_at').defaultNow().notNull()
	},
	(table) => [
		index('idx_movie_watch_providers_movie').on(table.movieId),
		uniqueIndex('idx_movie_watch_providers_unique').on(
			table.movieId,
			table.region,
			table.kind,
			table.providerId
		)
	]
);

// -----------------------------------------------------------------------------
// 4. CAST & CREW JUNCTIONS
// -----------------------------------------------------------------------------

export const movieCast = pgTable(
	'movie_cast',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		personId: uuid('person_id')
			.notNull()
			.references(() => people.id, { onDelete: 'cascade' }),
		character: varchar('character', { length: 500 }),
		castOrder: integer('cast_order'),
		creditId: varchar('credit_id', { length: 50 })
	},
	(table) => [
		index('idx_movie_cast_movie').on(table.movieId),
		index('idx_movie_cast_person').on(table.personId),
		uniqueIndex('idx_movie_cast_unique').on(table.movieId, table.personId, table.character)
	]
);

export const movieCrew = pgTable(
	'movie_crew',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		personId: uuid('person_id')
			.notNull()
			.references(() => people.id, { onDelete: 'cascade' }),
		department: varchar('department', { length: 100 }),
		job: varchar('job', { length: 100 }),
		creditId: varchar('credit_id', { length: 50 })
	},
	(table) => [
		index('idx_movie_crew_movie').on(table.movieId),
		index('idx_movie_crew_person').on(table.personId),
		uniqueIndex('idx_movie_crew_unique').on(table.movieId, table.personId, table.job)
	]
);

// -----------------------------------------------------------------------------
// 5. USERS & PERSONAL CINEMA ARCHIVE
// -----------------------------------------------------------------------------

export const users = pgTable(
	'users',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		username: varchar('username', { length: 50 }).notNull().unique(),
		passwordHash: varchar('password_hash', { length: 255 }).notNull(),
		displayName: varchar('display_name', { length: 100 }),
		avatarPath: varchar('avatar_path', { length: 255 }),
		role: varchar('role', { length: 20 }).default('member').notNull(),
		disabledAt: timestamp('disabled_at'),
		settings: jsonb('settings').default('{}'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('idx_users_email').on(table.email),
		uniqueIndex('idx_users_email_normalized').on(sql`lower(${table.email})`),
		index('idx_users_username').on(table.username),
		index('idx_users_role').on(table.role),
		uniqueIndex('idx_users_single_owner')
			.on(table.role)
			.where(sql`${table.role} = 'owner'`),
		check('users_role_check', sql`${table.role} in ('owner', 'admin', 'member')`)
	]
);

export const sessions = pgTable(
	'sessions',
	{
		id: varchar('id', { length: 255 }).primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
		revokedAt: timestamp('revoked_at')
	},
	(table) => [
		index('idx_sessions_user').on(table.userId),
		index('idx_sessions_active').on(table.userId, table.revokedAt, table.expiresAt)
	]
);

export const authInvites = pgTable(
	'auth_invites',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		email: varchar('email', { length: 255 }).notNull(),
		tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
		role: varchar('role', { length: 20 }).default('member').notNull(),
		invitedBy: uuid('invited_by')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
		expiresAt: timestamp('expires_at').notNull(),
		acceptedAt: timestamp('accepted_at'),
		revokedAt: timestamp('revoked_at'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('idx_auth_invites_email').on(table.email),
		index('idx_auth_invites_pending').on(table.email, table.expiresAt),
		check('auth_invites_role_check', sql`${table.role} in ('admin', 'member')`)
	]
);

export const authAuditEvents = pgTable(
	'auth_audit_events',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
		targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
		inviteId: uuid('invite_id').references(() => authInvites.id, { onDelete: 'set null' }),
		action: varchar('action', { length: 80 }).notNull(),
		metadata: jsonb('metadata'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('idx_auth_audit_actor').on(table.actorUserId),
		index('idx_auth_audit_target').on(table.targetUserId),
		index('idx_auth_audit_created').on(table.createdAt)
	]
);

export const rateLimits = pgTable(
	'rate_limits',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		// The deployed table historically called this column `ip`. Runtime code
		// stores only a keyed digest of the request subject in it.
		subjectHash: varchar('ip', { length: 255 }).notNull(),
		endpoint: varchar('endpoint', { length: 255 }).notNull(),
		hits: integer('hits').default(1).notNull(),
		expiresAt: timestamp('expires_at').notNull()
	},
	(table) => [
		uniqueIndex('idx_rate_limits_subject_endpoint').on(table.subjectHash, table.endpoint),
		index('idx_rate_limits_expires').on(table.expiresAt)
	]
);

export const userMovieInteractions = pgTable(
	'user_movie_interactions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		watched: boolean('watched').default(false).notNull(),
		watchlist: boolean('watchlist').default(false).notNull(),
		favorite: boolean('favorite').default(false).notNull(),
		rating: decimal('rating', { precision: 2, scale: 1 }), // 0.5 - 5.0
		watchDate: date('watch_date'),
		rewatchCount: integer('rewatch_count').default(0).notNull(),
		personalNotes: text('personal_notes'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('idx_umi_user_movie').on(table.userId, table.movieId),
		index('idx_umi_user').on(table.userId)
	]
);

export const userLists = pgTable(
	'user_lists',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 200 }).notNull(),
		description: text('description'),
		isPublic: boolean('is_public').default(false).notNull(),
		sortOrder: integer('sort_order').default(0).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [index('idx_user_lists_user').on(table.userId)]
);

export const userListItems = pgTable(
	'user_list_items',
	{
		listId: uuid('list_id')
			.notNull()
			.references(() => userLists.id, { onDelete: 'cascade' }),
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		position: integer('position').default(0).notNull(),
		addedAt: timestamp('added_at').defaultNow().notNull()
	},
	(table) => [primaryKey({ columns: [table.listId, table.movieId] })]
);

export const userReviews = pgTable(
	'user_reviews',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		content: text('content').notNull(),
		containsSpoilers: boolean('contains_spoilers').default(false).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [uniqueIndex('idx_user_reviews_user_movie').on(table.userId, table.movieId)]
);

// -----------------------------------------------------------------------------
// 5. ACTIVITY DIARY (Personal Logging)
// -----------------------------------------------------------------------------

export const activities = pgTable(
	'activities',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		actionType: varchar('action_type', { length: 50 }).notNull(), // 'rated', 'watched', 'favorited', 'watchlisted', 'reviewed', 'list_created'
		movieId: uuid('movie_id').references(() => movies.id, { onDelete: 'cascade' }),
		listId: uuid('list_id').references(() => userLists.id, { onDelete: 'cascade' }),
		metadata: jsonb('metadata'), // e.g. { rating: 5 }
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('idx_activities_user').on(table.userId),
		index('idx_activities_created_at').on(table.createdAt)
	]
);

export const aiChatSessions = pgTable(
	'ai_chat_sessions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		sessionKey: varchar('session_key', { length: 100 }).notNull(), // cookie value
		messages: jsonb('messages').notNull().default('[]'), // Gemini-format message array
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('idx_ai_sessions_user').on(table.userId),
		uniqueIndex('idx_ai_sessions_key').on(table.sessionKey)
	]
);

// -----------------------------------------------------------------------------
// 6. TV CATALOGUE (TMDB-backed, same standard-content policy as movies)
// -----------------------------------------------------------------------------

export const tvShows = pgTable('tv_shows', {
	id: uuid('id').defaultRandom().primaryKey(),
	tmdbId: integer('tmdb_id').notNull().unique(),
	name: text('name').notNull(),
	originalName: text('original_name'),
	overview: text('overview'),
	tagline: text('tagline'),
	posterPath: text('poster_path'),
	backdropPath: text('backdrop_path'),
	// Unknown stays null: never synthesise a date or a count TMDB does not provide.
	firstAirDate: date('first_air_date'),
	lastAirDate: date('last_air_date'),
	status: text('status'),
	numberOfSeasons: integer('number_of_seasons'),
	numberOfEpisodes: integer('number_of_episodes'),
	voteAverage: decimal('vote_average', { precision: 3, scale: 1 }),
	voteCount: integer('vote_count'),
	popularity: real('popularity'),
	originalLanguage: varchar('original_language', { length: 10 }),
	imdbId: varchar('imdb_id', { length: 20 }),
	adult: boolean('adult').default(false).notNull(),
	localOverrides: jsonb('local_overrides'),
	isLocked: boolean('is_locked').default(false).notNull(),
	syncedAt: timestamp('synced_at'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const tvGenres = pgTable(
	'tv_genres',
	{
		showId: uuid('show_id')
			.notNull()
			.references(() => tvShows.id, { onDelete: 'cascade' }),
		genreId: integer('genre_id')
			.notNull()
			.references(() => genres.id)
	},
	(table) => [primaryKey({ columns: [table.showId, table.genreId] })]
);

export const tvKeywords = pgTable(
	'tv_keywords',
	{
		showId: uuid('show_id')
			.notNull()
			.references(() => tvShows.id, { onDelete: 'cascade' }),
		keywordId: integer('keyword_id')
			.notNull()
			.references(() => keywords.id)
	},
	(table) => [primaryKey({ columns: [table.showId, table.keywordId] })]
);

export const tvSeasons = pgTable(
	'tv_seasons',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		showId: uuid('show_id')
			.notNull()
			.references(() => tvShows.id, { onDelete: 'cascade' }),
		seasonNumber: integer('season_number').notNull(),
		name: text('name'),
		overview: text('overview'),
		posterPath: text('poster_path'),
		airDate: date('air_date'),
		episodeCount: integer('episode_count')
	},
	(table) => [uniqueIndex('idx_tv_seasons_show_season').on(table.showId, table.seasonNumber)]
);

export const tvEpisodes = pgTable(
	'tv_episodes',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		showId: uuid('show_id')
			.notNull()
			.references(() => tvShows.id, { onDelete: 'cascade' }),
		seasonId: uuid('season_id')
			.notNull()
			.references(() => tvSeasons.id, { onDelete: 'cascade' }),
		seasonNumber: integer('season_number').notNull(),
		episodeNumber: integer('episode_number').notNull(),
		name: text('name'),
		overview: text('overview'),
		stillPath: text('still_path'),
		airDate: date('air_date'),
		runtime: integer('runtime'),
		voteAverage: decimal('vote_average', { precision: 3, scale: 1 })
	},
	(table) => [
		uniqueIndex('idx_tv_episodes_show_season_episode').on(
			table.showId,
			table.seasonNumber,
			table.episodeNumber
		)
	]
);

// -----------------------------------------------------------------------------
// 7. OWNER MEDIA LIBRARY (local files; paths never leave the server)
// -----------------------------------------------------------------------------

/** Server-only reference to a sidecar subtitle file (never sent to a client). */
export interface ExternalSubtitleRef {
	ordinal: number;
	path: string;
	language: string | null;
}

export const mediaFiles = pgTable(
	'media_files',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		path: text('path').notNull().unique(),
		sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
		mtimeMs: bigint('mtime_ms', { mode: 'number' }).notNull(),
		durationSeconds: real('duration_seconds'),
		video: jsonb('video').$type<VideoInfo | null>(),
		audioTracks: jsonb('audio_tracks').$type<AudioTrack[]>().default([]).notNull(),
		subtitleTracks: jsonb('subtitle_tracks').$type<SubtitleTrack[]>().default([]).notNull(),
		externalSubtitles: jsonb('external_subtitles')
			.$type<ExternalSubtitleRef[]>()
			.default([])
			.notNull(),
		movieId: uuid('movie_id').references(() => movies.id, { onDelete: 'set null' }),
		episodeId: uuid('episode_id').references(() => tvEpisodes.id, { onDelete: 'set null' }),
		matchStatus: varchar('match_status', { length: 20 }).default('unmatched').notNull(),
		matchNote: text('match_note'),
		parsed: jsonb('parsed').$type<ParsedName | null>(),
		scannedAt: timestamp('scanned_at').defaultNow().notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('idx_media_files_movie').on(table.movieId),
		index('idx_media_files_episode').on(table.episodeId),
		index('idx_media_files_match_status').on(table.matchStatus),
		check(
			'media_files_single_link_check',
			sql`${table.movieId} is null or ${table.episodeId} is null`
		)
	]
);

/** Saved playback position per user and file (the owner today), synced across devices. */
export const mediaProgress = pgTable(
	'media_progress',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		fileId: uuid('file_id')
			.notNull()
			.references(() => mediaFiles.id, { onDelete: 'cascade' }),
		positionSeconds: real('position_seconds').notNull(),
		durationSeconds: real('duration_seconds'),
		completed: boolean('completed').default(false).notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.fileId] }),
		index('idx_media_progress_user_updated').on(table.userId, table.updatedAt)
	]
);

// -----------------------------------------------------------------------------
// RELATIONS
// -----------------------------------------------------------------------------

export const moviesRelations = relations(movies, ({ one, many }) => ({
	collection: one(collections, {
		fields: [movies.collectionId],
		references: [collections.id]
	}),
	genres: many(movieGenres),
	keywords: many(movieKeywords),
	productionCompanies: many(movieProductionCompanies),
	cast: many(movieCast),
	crew: many(movieCrew),
	videos: many(movieVideos),
	watchProviders: many(movieWatchProviders),
	interactions: many(userMovieInteractions),
	reviews: many(userReviews)
}));

export const peopleRelations = relations(people, ({ many }) => ({
	castRoles: many(movieCast),
	crewRoles: many(movieCrew)
}));

export const movieGenresRelations = relations(movieGenres, ({ one }) => ({
	movie: one(movies, { fields: [movieGenres.movieId], references: [movies.id] }),
	genre: one(genres, { fields: [movieGenres.genreId], references: [genres.id] })
}));

export const genresRelations = relations(genres, ({ many }) => ({
	movies: many(movieGenres)
}));

export const movieKeywordsRelations = relations(movieKeywords, ({ one }) => ({
	movie: one(movies, { fields: [movieKeywords.movieId], references: [movies.id] }),
	keyword: one(keywords, { fields: [movieKeywords.keywordId], references: [keywords.id] })
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
	movies: many(movies)
}));

export const movieVideosRelations = relations(movieVideos, ({ one }) => ({
	movie: one(movies, { fields: [movieVideos.movieId], references: [movies.id] })
}));

export const movieWatchProvidersRelations = relations(movieWatchProviders, ({ one }) => ({
	movie: one(movies, { fields: [movieWatchProviders.movieId], references: [movies.id] })
}));

export const userMovieInteractionsRelations = relations(userMovieInteractions, ({ one }) => ({
	user: one(users, { fields: [userMovieInteractions.userId], references: [users.id] }),
	movie: one(movies, { fields: [userMovieInteractions.movieId], references: [movies.id] })
}));

export const userReviewsRelations = relations(userReviews, ({ one }) => ({
	user: one(users, { fields: [userReviews.userId], references: [users.id] }),
	movie: one(movies, { fields: [userReviews.movieId], references: [movies.id] })
}));

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	interactions: many(userMovieInteractions),
	reviews: many(userReviews),
	lists: many(userLists),
	activities: many(activities),
	aiChatSessions: many(aiChatSessions)
}));

export const userListsRelations = relations(userLists, ({ one, many }) => ({
	user: one(users, { fields: [userLists.userId], references: [users.id] }),
	items: many(userListItems)
}));

export const movieCastRelations = relations(movieCast, ({ one }) => ({
	movie: one(movies, { fields: [movieCast.movieId], references: [movies.id] }),
	person: one(people, { fields: [movieCast.personId], references: [people.id] })
}));

export const movieCrewRelations = relations(movieCrew, ({ one }) => ({
	movie: one(movies, { fields: [movieCrew.movieId], references: [movies.id] }),
	person: one(people, { fields: [movieCrew.personId], references: [people.id] })
}));

export const userListItemsRelations = relations(userListItems, ({ one }) => ({
	list: one(userLists, { fields: [userListItems.listId], references: [userLists.id] }),
	movie: one(movies, { fields: [userListItems.movieId], references: [movies.id] })
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
	user: one(users, { fields: [activities.userId], references: [users.id] }),
	movie: one(movies, { fields: [activities.movieId], references: [movies.id] }),
	list: one(userLists, { fields: [activities.listId], references: [userLists.id] })
}));

export const aiChatSessionsRelations = relations(aiChatSessions, ({ one }) => ({
	user: one(users, { fields: [aiChatSessions.userId], references: [users.id] })
}));

export const tvShowsRelations = relations(tvShows, ({ many }) => ({
	genres: many(tvGenres),
	keywords: many(tvKeywords),
	seasons: many(tvSeasons),
	episodes: many(tvEpisodes)
}));

export const tvGenresRelations = relations(tvGenres, ({ one }) => ({
	show: one(tvShows, { fields: [tvGenres.showId], references: [tvShows.id] }),
	genre: one(genres, { fields: [tvGenres.genreId], references: [genres.id] })
}));

export const tvKeywordsRelations = relations(tvKeywords, ({ one }) => ({
	show: one(tvShows, { fields: [tvKeywords.showId], references: [tvShows.id] }),
	keyword: one(keywords, { fields: [tvKeywords.keywordId], references: [keywords.id] })
}));

export const tvSeasonsRelations = relations(tvSeasons, ({ one, many }) => ({
	show: one(tvShows, { fields: [tvSeasons.showId], references: [tvShows.id] }),
	episodes: many(tvEpisodes)
}));

export const tvEpisodesRelations = relations(tvEpisodes, ({ one, many }) => ({
	show: one(tvShows, { fields: [tvEpisodes.showId], references: [tvShows.id] }),
	season: one(tvSeasons, { fields: [tvEpisodes.seasonId], references: [tvSeasons.id] }),
	mediaFiles: many(mediaFiles)
}));

export const mediaFilesRelations = relations(mediaFiles, ({ one, many }) => ({
	movie: one(movies, { fields: [mediaFiles.movieId], references: [movies.id] }),
	episode: one(tvEpisodes, { fields: [mediaFiles.episodeId], references: [tvEpisodes.id] }),
	progress: many(mediaProgress)
}));

export const mediaProgressRelations = relations(mediaProgress, ({ one }) => ({
	user: one(users, { fields: [mediaProgress.userId], references: [users.id] }),
	file: one(mediaFiles, { fields: [mediaProgress.fileId], references: [mediaFiles.id] })
}));
