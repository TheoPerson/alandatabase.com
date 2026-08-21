import { db, schema } from '../db.js';
import { TMDBClient, type TMDBMovieDetail } from './client.js';
import { eq } from 'drizzle-orm';
import { notifyMovieIngested } from '../../../src/lib/server/services/telegram.service.js';

export async function ingestMovie(
	tmdbId: number,
	options: { notifyTelegram?: boolean } = { notifyTelegram: false }
): Promise<string | null> {
	const client = new TMDBClient();

	try {
		const detail: TMDBMovieDetail = await client.getMovieDetails(tmdbId);

		// Quality threshold check
		if (!detail.poster_path || !detail.overview || detail.vote_count < 5) {
			console.log(`⏩ Skipping TMDB #${tmdbId} ("${detail.title}") - failed quality threshold.`);
			return null;
		}

		// 1. Handle Collection
		let collectionUuid: string | null = null;
		if (detail.belongs_to_collection) {
			const coll = detail.belongs_to_collection;
			const [existingColl] = await db
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
		const [movie] = await db
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

		if (!movie) return null;
		const movieId = movie.id;

		// 3. Link Genres
		if (detail.genres && detail.genres.length > 0) {
			for (const g of detail.genres) {
				await db.insert(schema.genres).values({ id: g.id, name: g.name }).onConflictDoNothing();

				await db
					.insert(schema.movieGenres)
					.values({ movieId, genreId: g.id })
					.onConflictDoNothing();
			}
		}

		// 4. Link Keywords
		if (detail.keywords?.keywords) {
			for (const kw of detail.keywords.keywords) {
				await db.insert(schema.keywords).values({ id: kw.id, name: kw.name }).onConflictDoNothing();

				await db
					.insert(schema.movieKeywords)
					.values({ movieId, keywordId: kw.id })
					.onConflictDoNothing();
			}
		}

		// 5. Ingest Cast & People
		if (detail.credits?.cast) {
			for (const c of detail.credits.cast.slice(0, 20)) {
				const [person] = await db
					.insert(schema.people)
					.values({
						tmdbId: c.id,
						name: c.name,
						profilePath: c.profile_path,
						knownForDepartment: c.known_for_department
					})
					.onConflictDoUpdate({
						target: schema.people.tmdbId,
						set: {
							name: c.name,
							profilePath: c.profile_path
						}
					})
					.returning();

				if (person) {
					await db
						.insert(schema.movieCast)
						.values({
							movieId,
							personId: person.id,
							character: c.character,
							castOrder: c.order,
							creditId: c.credit_id
						})
						.onConflictDoNothing();
				}
			}
		}

		// 6. Ingest Directors / Key Crew
		if (detail.credits?.crew) {
			const keyCrew = detail.credits.crew.filter((c) =>
				[
					'Director',
					'Writer',
					'Screenplay',
					'Producer',
					'Director of Photography',
					'Composer'
				].includes(c.job)
			);

			for (const cr of keyCrew) {
				const [person] = await db
					.insert(schema.people)
					.values({
						tmdbId: cr.id,
						name: cr.name,
						profilePath: cr.profile_path,
						knownForDepartment: cr.known_for_department
					})
					.onConflictDoUpdate({
						target: schema.people.tmdbId,
						set: {
							name: cr.name,
							profilePath: cr.profile_path
						}
					})
					.returning();

				if (person) {
					await db
						.insert(schema.movieCrew)
						.values({
							movieId,
							personId: person.id,
							department: cr.department,
							job: cr.job,
							creditId: cr.credit_id
						})
						.onConflictDoNothing();
				}
			}
		}

		// 7. Ingest Videos
		if (detail.videos?.results) {
			for (const v of detail.videos.results) {
				if (v.site === 'YouTube' && ['Trailer', 'Teaser'].includes(v.type)) {
					await db
						.insert(schema.movieVideos)
						.values({
							movieId,
							key: v.key,
							site: v.site,
							type: v.type,
							name: v.name,
							official: v.official,
							publishedAt: v.published_at ? new Date(v.published_at) : null
						})
						.onConflictDoNothing();
				}
			}
		}

		console.log(
			`✅ Successfully ingested "${detail.title}" (${detail.release_date?.substring(0, 4) || 'N/A'})`
		);
		if (options.notifyTelegram) {
			notifyMovieIngested(
				detail.title,
				detail.release_date?.substring(0, 4),
				detail.id,
				detail.poster_path
			).catch(() => {});
		}
		return movieId;
	} catch (err) {
		console.error(`❌ Ingestion failed for TMDB #${tmdbId}:`, err);
		return null;
	}
}
