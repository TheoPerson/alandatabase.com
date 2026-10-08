import { getWorkerDatabase, schema } from '../db.js';
import { TMDBClient, type TMDBMovieDetail } from './client.js';
import { evaluateTMDBIngestionSafety } from './ingest-safety.js';
import { and, eq, inArray, sql } from 'drizzle-orm';

export async function ingestMovie(tmdbId: number): Promise<string | null> {
	const client = new TMDBClient();

	try {
		const detail: TMDBMovieDetail = await client.getMovieDetails(tmdbId);
		const safetyDecision = evaluateTMDBIngestionSafety(detail);

		// Classification must succeed before the first database write below.
		if (!safetyDecision.allowed) {
			const keywordContext =
				safetyDecision.reason === 'explicit-keyword'
					? ` (keyword ${safetyDecision.keywordId})`
					: '';
			console.warn(
				`Blocked TMDB #${tmdbId} before ingestion: ${safetyDecision.reason}${keywordContext}.`
			);
			return null;
		}

		// Quality threshold check
		if (!detail.poster_path || !detail.overview || detail.vote_count < 5) {
			console.log(`⏩ Skipping TMDB #${tmdbId} ("${detail.title}") - failed quality threshold.`);
			return null;
		}

		const db = getWorkerDatabase();

		// Locked catalog rows are never touched. Check before the first write
		// so a locked conflict cannot leave a half-written collection row
		// behind (the old code wrote the collection, then dropped the movie).
		const [lockedRow] = await db
			.select({ id: schema.movies.id })
			.from(schema.movies)
			.where(and(eq(schema.movies.tmdbId, detail.id), eq(schema.movies.isLocked, true)))
			.limit(1);
		if (lockedRow) {
			console.log(`⏩ Skipping TMDB #${tmdbId} ("${detail.title}") - catalog row is locked.`);
			return null;
		}

		// Every write for one movie happens inside a single transaction: a
		// crash mid-ingest can no longer leave a movie without cast, keywords,
		// or videos. Junction rows are bulk-inserted, not written one by one.
		const movieId = await db.transaction(async (tx) => {
			// 1. Handle Collection
			let collectionUuid: string | null = null;
			if (detail.belongs_to_collection) {
				const coll = detail.belongs_to_collection;
				const [existingColl] = await tx
					.insert(schema.collections)
					.values({
						tmdbId: coll.id,
						name: coll.name,
						posterPath: coll.poster_path,
						backdropPath: coll.backdrop_path
					})
					.onConflictDoUpdate({
						target: schema.collections.tmdbId,
						set: {
							name: coll.name,
							posterPath: coll.poster_path,
							backdropPath: coll.backdrop_path
						}
					})
					.returning();

				if (existingColl) {
					collectionUuid = existingColl.id;
				}
			}

			// 2. Insert or Update Movie
			const [movie] = await tx
				.insert(schema.movies)
				.values({
					tmdbId: detail.id,
					imdbId: detail.imdb_id,
					title: detail.title,
					originalTitle: detail.original_title,
					originalLanguage: detail.original_language,
					overview: detail.overview,
					tagline: detail.tagline,
					posterPath: detail.poster_path,
					backdropPath: detail.backdrop_path,
					releaseDate: detail.release_date || null,
					runtime: detail.runtime,
					status: detail.status,
					budget: detail.budget,
					revenue: detail.revenue,
					popularity: detail.popularity.toString(),
					voteAverage: detail.vote_average.toString(),
					voteCount: detail.vote_count,
					adult: detail.adult,
					collectionId: collectionUuid,
					syncedAt: new Date()
				})
				.onConflictDoUpdate({
					target: schema.movies.tmdbId,
					set: {
						title: detail.title,
						overview: detail.overview,
						tagline: detail.tagline,
						posterPath: detail.poster_path,
						backdropPath: detail.backdrop_path,
						runtime: detail.runtime,
						popularity: detail.popularity.toString(),
						voteAverage: detail.vote_average.toString(),
						voteCount: detail.vote_count,
						syncedAt: new Date(),
						updatedAt: new Date()
					},
					where: eq(schema.movies.isLocked, false)
				})
				.returning();

			// Locked between the pre-check and this write: abort the whole
			// transaction instead of leaving a partial movie behind.
			if (!movie) return null;
			const movieRowId = movie.id;

			// 3. Link Genres (bulk)
			const genreRows = detail.genres ?? [];
			if (genreRows.length > 0) {
				await tx
					.insert(schema.genres)
					.values(genreRows.map((g) => ({ id: g.id, name: g.name })))
					.onConflictDoNothing();
				await tx
					.insert(schema.movieGenres)
					.values(genreRows.map((g) => ({ movieId: movieRowId, genreId: g.id })))
					.onConflictDoNothing();
			}

			// 4. Link Keywords (bulk)
			const keywordRows = detail.keywords?.keywords ?? [];
			if (keywordRows.length > 0) {
				await tx
					.insert(schema.keywords)
					.values(keywordRows.map((kw) => ({ id: kw.id, name: kw.name })))
					.onConflictDoNothing();
				await tx
					.insert(schema.movieKeywords)
					.values(keywordRows.map((kw) => ({ movieId: movieRowId, keywordId: kw.id })))
					.onConflictDoNothing();
			}

			// 5+6. Ingest Cast & Key Crew (bulk people upsert, one id lookup)
			const castRows = detail.credits?.cast?.slice(0, 20) ?? [];
			const keyCrewRows = (detail.credits?.crew ?? []).filter((c) =>
				[
					'Director',
					'Writer',
					'Screenplay',
					'Producer',
					'Director of Photography',
					'Composer'
				].includes(c.job)
			);
			const creditTmdbIds = [...new Set([...castRows, ...keyCrewRows].map((c) => c.id))];
			if (creditTmdbIds.length > 0) {
				const creditByTmdbId = new Map(
					[...castRows, ...keyCrewRows].map((c) => [c.id, c])
				);
				await tx
					.insert(schema.people)
					.values(
						creditTmdbIds.map((tmdbId) => {
							const c = creditByTmdbId.get(tmdbId)!;
							return {
								tmdbId: c.id,
								name: c.name,
								profilePath: c.profile_path,
								knownForDepartment: c.known_for_department
							};
						})
					)
					.onConflictDoUpdate({
						target: schema.people.tmdbId,
						set: {
							name: sql`excluded."name"`,
							profilePath: sql`excluded."profile_path"`
						}
					});
				const peopleRows = await tx
					.select({ id: schema.people.id, tmdbId: schema.people.tmdbId })
					.from(schema.people)
					.where(inArray(schema.people.tmdbId, creditTmdbIds));
				const personIdByTmdbId = new Map(peopleRows.map((p) => [p.tmdbId, p.id]));

				const castLinks = [];
				for (const c of castRows) {
					const personId = personIdByTmdbId.get(c.id);
					if (personId) {
						castLinks.push({
							movieId: movieRowId,
							personId,
							character: c.character,
							castOrder: c.order,
							creditId: c.credit_id
						});
					}
				}
				if (castLinks.length > 0) {
					await tx.insert(schema.movieCast).values(castLinks).onConflictDoNothing();
				}

				const crewLinks = [];
				for (const cr of keyCrewRows) {
					const personId = personIdByTmdbId.get(cr.id);
					if (personId) {
						crewLinks.push({
							movieId: movieRowId,
							personId,
							department: cr.department,
							job: cr.job,
							creditId: cr.credit_id
						});
					}
				}
				if (crewLinks.length > 0) {
					await tx.insert(schema.movieCrew).values(crewLinks).onConflictDoNothing();
				}
			}

			// 7. Ingest Videos (bulk)
			const videoRows = (detail.videos?.results ?? []).filter(
				(v) => v.site === 'YouTube' && ['Trailer', 'Teaser'].includes(v.type)
			);
			if (videoRows.length > 0) {
				await tx
					.insert(schema.movieVideos)
					.values(
						videoRows.map((v) => ({
							movieId: movieRowId,
							key: v.key,
							site: v.site,
							type: v.type,
							name: v.name,
							official: v.official,
							publishedAt: v.published_at ? new Date(v.published_at) : null
						}))
					)
					.onConflictDoNothing();
			}

			return movieRowId;
		});

		if (!movieId) return null;

		console.log(
			`✅ Successfully ingested "${detail.title}" (${detail.release_date?.substring(0, 4) || 'N/A'})`
		);
		return movieId;
	} catch (err) {
		console.error(`❌ Ingestion failed for TMDB #${tmdbId}:`, err);
		return null;
	}
}
