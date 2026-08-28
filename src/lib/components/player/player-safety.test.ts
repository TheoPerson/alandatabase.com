import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(currentDirectory, '../../..');

const playbackFiles = [
	'lib/components/movie/PlayerSheet.svelte',
	'lib/components/player/StreamPlayerContainer.svelte',
	'routes/(cinema)/live/+page.svelte',
	'routes/(cinema)/tv/[id]/+page.svelte'
];

const blockedPatterns = [
	/<iframe/i,
	/vidsrc/i,
	/multiembed/i,
	/autoembed/i,
	/fawanews/i,
	/allow-same-origin/i,
	/clipboard-write/i
];

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return /\.(?:svelte|ts|js)$/u.test(entry.name) ? [path] : [];
	});
}

describe('playback source quarantine', () => {
	it('contains no blocked mirror anywhere in application source', () => {
		for (const file of sourceFiles(sourceRoot)) {
			if (file.endsWith('player-safety.test.ts')) continue;
			const source = readFileSync(file, 'utf8');
			for (const pattern of blockedPatterns.slice(1, 5)) {
				expect(source, file).not.toMatch(pattern);
			}
		}
	});

	for (const relativePath of playbackFiles) {
		it(`${relativePath} contains no iframe or blocked mirror`, () => {
			const source = readFileSync(resolve(sourceRoot, relativePath), 'utf8');

			for (const pattern of blockedPatterns) {
				expect(source).not.toMatch(pattern);
			}
		});
	}

	it('does not accept or persist arbitrary custom video URLs', () => {
		const serverSource = readFileSync(
			resolve(sourceRoot, 'routes/(cinema)/movies/custom/+page.server.ts'),
			'utf8'
		);
		const pageSource = readFileSync(
			resolve(sourceRoot, 'routes/(cinema)/movies/custom/+page.svelte'),
			'utf8'
		);

		expect(serverSource).not.toContain('customVideoUrl');
		expect(pageSource).not.toContain('customVideoUrl');
	});

	it('uses canonical movie and TV detail routes from browse surfaces', () => {
		const movieBrowse = readFileSync(
			resolve(sourceRoot, 'routes/(cinema)/movies/+page.svelte'),
			'utf8'
		);
		const tvBrowse = readFileSync(resolve(sourceRoot, 'routes/(cinema)/tv/+page.svelte'), 'utf8');

		expect(movieBrowse).not.toContain('/cinema/movies/');
		expect(tvBrowse).not.toContain('/cinema/tvshow/');
		expect(movieBrowse).toContain('href="/movies/{movie.id || movie.tmdbId}"');
		expect(tvBrowse).toContain('href="/tv/{hero.tmdbId}"');
		expect(tvBrowse).toContain('href="/tv/{show.tmdbId}"');
	});

	it('renders movie detail fields from the server database model', () => {
		const detailSource = readFileSync(
			resolve(sourceRoot, 'routes/(cinema)/movies/[id]/+page.svelte'),
			'utf8'
		);

		expect(detailSource).not.toContain('movie.vote_average');
		expect(detailSource).not.toContain('movie.release_date');
		expect(detailSource).not.toContain('movie.backdrop_path');
		expect(detailSource).toContain('movie.voteAverage');
		expect(detailSource).toContain('movie.releaseDate');
		expect(detailSource).toContain('movie.backdropPath');
	});
});
