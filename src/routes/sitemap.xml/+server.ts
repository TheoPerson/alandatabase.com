import { db } from '$lib/server/db';
import { movies } from '$lib/server/db/schema';
import { standardMovieVisibilityWhere } from '$lib/server/policies/movie-visibility';
import { desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const STATIC_URLS = [
	{ location: 'https://alandatabase.com/', priority: '1.0', frequency: 'weekly' },
	{ location: 'https://alandatabase.com/movies', priority: '0.9', frequency: 'daily' },
	{ location: 'https://alandatabase.com/movies/catalog', priority: '0.8', frequency: 'daily' },
	{ location: 'https://alandatabase.com/tv', priority: '0.8', frequency: 'weekly' },
	{ location: 'https://alandatabase.com/discover', priority: '0.7', frequency: 'daily' },
	{ location: 'https://status.alandatabase.com/', priority: '0.3', frequency: 'daily' }
];

function escapeXml(value: string): string {
	return value.replace(/[<>&'"]/gu, (character) => {
		const entities: Record<string, string> = {
			'<': '&lt;',
			'>': '&gt;',
			'&': '&amp;',
			"'": '&apos;',
			'"': '&quot;'
		};
		return entities[character];
	});
}

export const GET: RequestHandler = async () => {
	let movieUrls: Array<{ location: string; modified: string }> = [];

	try {
		const publishedMovies = await db
			.select({ id: movies.id, updatedAt: movies.updatedAt })
			.from(movies)
			.where(standardMovieVisibilityWhere())
			.orderBy(desc(movies.updatedAt))
			.limit(20_000);

		movieUrls = publishedMovies.map((movie) => ({
			location: `https://alandatabase.com/movies/${movie.id}`,
			modified: movie.updatedAt.toISOString().slice(0, 10)
		}));
	} catch {
		// Static public routes remain discoverable if the catalogue is degraded.
	}

	const staticEntries = STATIC_URLS.map(
		(url) => `
	<url>
		<loc>${escapeXml(url.location)}</loc>
		<changefreq>${url.frequency}</changefreq>
		<priority>${url.priority}</priority>
	</url>`
	).join('');
	const movieEntries = movieUrls
		.map(
			(url) => `
	<url>
		<loc>${escapeXml(url.location)}</loc>
		<lastmod>${url.modified}</lastmod>
		<changefreq>monthly</changefreq>
		<priority>0.7</priority>
	</url>`
		)
		.join('');

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries}${movieEntries}
</urlset>`,
		{
			headers: {
				'content-type': 'application/xml; charset=utf-8',
				'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
			}
		}
	);
};
