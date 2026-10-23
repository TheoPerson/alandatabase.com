import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { formatSummary, parseScanArgs } from './cli-scan.js';
import type { ScanSummary } from './scan.js';

describe('parseScanArgs', () => {
	it('takes roots from the arguments, then from MEDIA_LIBRARY_ROOTS', () => {
		assert.deepEqual(parseScanArgs(['F:/MOVIES', '--dry-run'], {}), {
			roots: ['F:/MOVIES'],
			dryRun: true,
			error: null
		});
		const env = { MEDIA_LIBRARY_ROOTS: ['F:/MOVIES', ' G:/TV '].join(path.delimiter) };
		assert.deepEqual(parseScanArgs([], env).roots, ['F:/MOVIES', 'G:/TV']);
		assert.deepEqual(parseScanArgs(['--roots-from-env'], env).roots, ['F:/MOVIES', 'G:/TV']);
	});

	it('rejects unknown options, missing roots and roots next to --roots-from-env', () => {
		assert.match(parseScanArgs(['--force'], {}).error ?? '', /Unknown option/u);
		assert.match(parseScanArgs([], {}).error ?? '', /MEDIA_LIBRARY_ROOTS/u);
		assert.match(parseScanArgs(['--roots-from-env', 'F:/X'], {}).error ?? '', /no root argument/u);
	});
});

describe('formatSummary', () => {
	it('lists counts, and paths only for files needing attention', () => {
		const summary: ScanSummary = {
			dryRun: false,
			roots: 1,
			missingRoots: 0,
			videosFound: 3,
			skippedSmall: 1,
			skippedSample: 0,
			skippedExplicit: 1,
			probed: 3,
			probeReused: 0,
			probeFailed: 0,
			matchedMovies: 1,
			matchedEpisodes: 1,
			unmatched: 1,
			ambiguous: 0,
			moviesIngested: 1,
			showsIngested: 1,
			inserted: 3,
			updated: 0,
			unchanged: 0,
			deleted: 0,
			sidecarSubtitles: 0,
			tmdbSearches: 3,
			timingsMs: { walk: 5 },
			unmatchedFiles: [{ path: 'Recording.2025.mkv', note: 'no TMDB result' }],
			ambiguousFiles: []
		};
		const text = formatSummary(summary);
		assert.match(text, /1 film files, 1 episode files, 1 unmatched/u);
		assert.match(text, /Recording\.2025\.mkv :: no TMDB result/u);
		assert.doesNotMatch(text, /Ambiguous/u);
	});
});
