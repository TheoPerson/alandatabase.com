import 'dotenv/config';
import { MeiliSearch } from 'meilisearch';
import { db, schema } from '../db.js';
import { eq } from 'drizzle-orm';

const meiliHost = process.env.MEILI_HOST || 'http://localhost:7700';
const meiliKey = process.env.MEILI_MASTER_KEY || '';

export const meili = new MeiliSearch({
	host: meiliHost,
	apiKey: meiliKey
});

export const MOVIES_INDEX = 'movies';

export async function setupMeilisearchIndexes() {
	console.log('🔍 Setting up Meilisearch indexes...');
	try {
		const index = meili.index(MOVIES_INDEX);

		await index.updateSettings({
			searchableAttributes: [
				'title',
				'original_title',
				'overview',
				'director_names',
				'cast_names',
				'keywords'
			],
			filterableAttributes: [
				'genres',
				'release_year',
				'original_language',
				'vote_average',
				'adult'
			],
			sortableAttributes: ['popularity', 'vote_average', 'release_date', 'title'],
			rankingRules: [
				'words',
				'typo',
				'proximity',
				'attribute',
				'sort',
				'exactness',
				'popularity:desc'
			]
		});

		console.log('✅ Meilisearch indexes configured.');
	} catch (err) {
		console.error('❌ Meilisearch setup failed:', err);
	}
}

export async function indexMovieInMeilisearch(movieId: string) {
	try {
		const movie = await db.query.movies.findFirst({
			where: eq(schema.movies.id, movieId),
			with: {
				genres: {
					with: {
						genre: true
					}
				},
				cast: {
					with: {
						person: true
					}
				},
				crew: {
					with: {
						person: true
					}
				}
			}
		});

		if (!movie) return;

		const releaseYear = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null;
		const directors = movie.crew
			.filter((c: any) => c.job === 'Director')
			.map((c: any) => c.person?.name)
			.filter(Boolean);
		const topCast = movie.cast
			.slice(0, 10)
			.map((c: any) => c.person?.name)
			.filter(Boolean);

		const document = {
			id: movie.id,
			tmdb_id: movie.tmdbId,
			title: movie.title,
			original_title: movie.originalTitle,
			overview: movie.overview,
			poster_path: movie.posterPath,
			backdrop_path: movie.backdropPath,
			release_date: movie.releaseDate,
			release_year: releaseYear,
			original_language: movie.originalLanguage,
			popularity: Number(movie.popularity || 0),
			vote_average: Number(movie.voteAverage || 0),
			vote_count: movie.voteCount || 0,
			genres: movie.genres.map((g: any) => g.genre?.name).filter(Boolean),
			director_names: directors,
			cast_names: topCast,
			adult: movie.adult
		};

		await meili.index(MOVIES_INDEX).addDocuments([document]);
	} catch (err) {
		console.error(`❌ Failed to index movie ${movieId}:`, err);
	}
}
