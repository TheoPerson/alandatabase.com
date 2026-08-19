import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
	BLOCKED_TMDB_KEYWORD_IDS,
	evaluateTMDBIngestionSafety,
	type TMDBIngestionCandidate
} from './ingest-safety.js';

test('allows a non-adult TMDB title with complete safe keyword classification', () => {
	assert.deepEqual(
		evaluateTMDBIngestionSafety({
			adult: false,
			keywords: { keywords: [{ id: 12 }, { id: 18 }] }
		}),
		{ allowed: true }
	);
});

test('blocks TMDB adult titles before ingestion', () => {
	assert.deepEqual(evaluateTMDBIngestionSafety({ adult: true, keywords: { keywords: [] } }), {
		allowed: false,
		reason: 'adult-flagged'
	});
});

for (const keywordId of BLOCKED_TMDB_KEYWORD_IDS) {
	test(`blocks explicit TMDB keyword ${keywordId}`, () => {
		assert.deepEqual(
			evaluateTMDBIngestionSafety({
				adult: false,
				keywords: { keywords: [{ id: keywordId }] }
			}),
			{ allowed: false, reason: 'explicit-keyword', keywordId }
		);
	});
}

const unclassifiedCandidates: TMDBIngestionCandidate[] = [
	{ keywords: { keywords: [] } },
	{ adult: false },
	{ adult: false, keywords: {} },
	{ adult: false, keywords: { keywords: [{ id: null }] } }
];

for (const [index, candidate] of unclassifiedCandidates.entries()) {
	test(`fails closed when classification input ${index + 1} is incomplete`, () => {
		assert.equal(evaluateTMDBIngestionSafety(candidate).allowed, false);
	});
}

test('legacy adult launch paths and package aliases remain quarantined', () => {
	const packageJson = JSON.parse(
		readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
	) as { scripts?: Record<string, string> };
	const movieIngestor = readFileSync(new URL('./ingest-movies.ts', import.meta.url), 'utf8');
	const legacyAdultIngestor = readFileSync(new URL('./ingest-adult.ts', import.meta.url), 'utf8');
	const adultLauncher = readFileSync(
		new URL('../../bulk-ingest-adult.ts', import.meta.url),
		'utf8'
	);
	const publicExplicitLauncher = readFileSync(
		new URL('../../ingest-public-erotic.ts', import.meta.url),
		'utf8'
	);

	assert.equal(packageJson.scripts?.['ingest:public-erotic'], undefined);
	assert.equal(packageJson.scripts?.['ingest:adult-alex'], undefined);
	const safetyCheckIndex = movieIngestor.indexOf('evaluateTMDBIngestionSafety(detail)');
	const firstDatabaseWriteIndex = movieIngestor.indexOf('.insert(');
	assert.notEqual(safetyCheckIndex, -1);
	assert.notEqual(firstDatabaseWriteIndex, -1);
	assert.ok(safetyCheckIndex < firstDatabaseWriteIndex);
	assert.doesNotMatch(
		legacyAdultIngestor,
		/customVideoUrl|\.insert\(|video\.embed|from ['"]\.\.\/db/
	);
	assert.doesNotMatch(adultLauncher, /fetch\(|ingestAdultVideo/);
	assert.doesNotMatch(publicExplicitLauncher, /fetch\(|discoverMovies|ingestMovie/);
});

test('worker cli validates commands before database setup or network actions', () => {
	const cliSource = readFileSync(new URL('../cli.ts', import.meta.url), 'utf8');
	const commandValidationIndex = cliSource.indexOf('!validCommands.has(command)');
	const databaseSetupIndex = cliSource.indexOf('await ensureTablesExist()');
	const firstNetworkActionIndex = cliSource.indexOf('await syncGenres()');

	assert.notEqual(commandValidationIndex, -1);
	assert.notEqual(databaseSetupIndex, -1);
	assert.notEqual(firstNetworkActionIndex, -1);
	assert.ok(commandValidationIndex < databaseSetupIndex);
	assert.ok(commandValidationIndex < firstNetworkActionIndex);
});
