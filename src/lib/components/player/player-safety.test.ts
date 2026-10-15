import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(currentDirectory, '../../..');

const playbackFiles = [
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

// Only the official IFrame API adapter and the CSP allowlist may name the trailer embed host.
const youtubeAdapter = 'lib/player/youtube-source.ts';
const youtubeHostFiles = [youtubeAdapter, 'lib/server/security/response-policy.ts'];
const youtubeHostPattern = /youtube-nocookie/i;

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
			for (const pattern of blockedPatterns) {
				expect(source, file).not.toMatch(pattern);
			}
		}
	});

	it('names the trailer embed host only in the YouTube IFrame API adapter', () => {
		const allowed = new Set(youtubeHostFiles.map((path) => resolve(sourceRoot, path)));
		for (const path of allowed) {
			expect(readFileSync(path, 'utf8'), path).toMatch(youtubeHostPattern);
		}

		for (const file of sourceFiles(sourceRoot)) {
			if (allowed.has(file) || /\.test\.ts$/u.test(file)) continue;
			expect(readFileSync(file, 'utf8'), file).not.toMatch(youtubeHostPattern);
		}
	});

	it('builds the embed through the official API, never a literal iframe', () => {
		const adapter = readFileSync(resolve(sourceRoot, youtubeAdapter), 'utf8');
		expect(adapter).not.toMatch(/<iframe/i);
		expect(adapter).toMatch(/new YT\.Player\(/u);
		expect(adapter).toMatch(/isYouTubeKey\(/u);
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
		// Browse renders loader-built PosterItems whose href is always /movies/<id> (toPosterItem).
		expect(movieBrowse).not.toContain('href="/cinema/');
		expect(tvBrowse).toContain('href="/tv/{hero.tmdbId}"');
		expect(tvBrowse).toContain('href="/tv/{show.tmdbId}"');
	});

	it('renders movie detail fields from the server database model', () => {
		const detailSource = readFileSync(
			resolve(sourceRoot, 'routes/(cinema)/movies/[id]/+page.svelte'),
			'utf8'
		);

		// The page reads the loader's camelCase shape, never raw TMDB snake_case fields.
		expect(detailSource).not.toMatch(/\b(vote_average|release_date|backdrop_path|poster_path)\b/u);
		expect(detailSource).toContain('data.hero.backdropPath');
		expect(detailSource).toContain('data.details.releaseDate');
		expect(detailSource).toContain('data.hero.rating');
	});
});
