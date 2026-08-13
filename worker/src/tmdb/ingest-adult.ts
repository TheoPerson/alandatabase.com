import { db, schema } from '../db.js';

export async function ingestAdultVideo(video: any): Promise<string | null> {
	try {
		// Generate a negative TMDB ID for custom videos to bypass TMDB proxy lookups
		const negativeId = -Math.floor(Math.random() * 1000000) - 100000;
		
		const [movie] = await db
			.insert(schema.movies)
			.values({
				tmdbId: negativeId,
				title: video.title,
				overview: `Keywords: ${video.keywords}`,
				posterPath: video.default_thumb.src,
				backdropPath: video.default_thumb.src,
				popularity: video.views.toString(),
				voteAverage: video.rate.toString(),
				voteCount: parseInt(video.views) || 0,
				adult: true,
				syncedAt: new Date(),
				localOverrides: {
					customVideoUrl: video.embed
				}
			})
			.returning();

		if (!movie) return null;
		
		console.log(`✅ Successfully ingested adult video: "${video.title}"`);
		return movie.id;
	} catch (err) {
		console.error(`❌ Ingestion failed for adult video: ${video.title}`, err);
		return null;
	}
}
