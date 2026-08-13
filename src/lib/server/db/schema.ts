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
	primaryKey,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => [
		index('idx_users_email').on(table.email),
		index('idx_users_username').on(table.username)
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
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('idx_sessions_user').on(table.userId)]
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
		sessionKey: varchar('session_key', { length: 100 }).notNull().unique(), // cookie value
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

export const userMovieInteractionsRelations = relations(userMovieInteractions, ({ one }) => ({
	user: one(users, { fields: [userMovieInteractions.userId], references: [users.id] }),
	movie: one(movies, { fields: [userMovieInteractions.movieId], references: [movies.id] })
}));

export const userReviewsRelations = relations(userReviews, ({ one }) => ({
	user: one(users, { fields: [userReviews.userId], references: [users.id] }),
	movie: one(movies, { fields: [userReviews.movieId], references: [movies.id] })
}));

export const usersRelations = relations(users, ({ many }) => ({
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


