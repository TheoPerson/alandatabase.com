import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { closeWorkerDatabase, getWorkerDatabase } from '../db.js';
import { ingestMovie } from '../tmdb/ingest-movies.js';
import { TmdbHttp, tmdbGate } from '../tv/tmdb-http.js';
import { createTmdbTvSource, ingestTvShow, type WorkerDb } from '../tv/ingest-tv.js';
import { createTmdbMatchSource, Matcher } from './match.js';
import { probeFile } from './probe.js';
import { scanLibrary, type ScanSummary } from './scan.js';

export const SCAN_USAGE = `Usage: tsx src/cli.ts scan-library [root ...] [--dry-run]
  Roots default to MEDIA_LIBRARY_ROOTS (separated by "${path.delimiter}").
  Needs FFPROBE_PATH (or ffprobe on PATH), TMDB_API_KEY, and WORKER_DATABASE_URL unless --dry-run.
  The library is only read: nothing under a root is ever written, renamed or deleted.`;

export interface ScanCommandArgs {
	roots: string[];
	dryRun: boolean;
	error: string | null;
}

const OPTIONS = new Set(['--dry-run', '--roots-from-env']);

/**
 * Parses `scan-library` arguments. Roots fall back to MEDIA_LIBRARY_ROOTS; `--roots-from-env`
 * (the `library:index` script) insists on the configured roots. Pure.
 */
export function parseScanArgs(
	argv: string[],
	env: Record<string, string | undefined>
): ScanCommandArgs {
	const dryRun = argv.includes('--dry-run');
	const unknown = argv.find((arg) => arg.startsWith('--') && !OPTIONS.has(arg));
	if (unknown) return { roots: [], dryRun, error: `Unknown option ${unknown}` };
	let roots = argv.filter((arg) => !arg.startsWith('--'));
	if (argv.includes('--roots-from-env') && roots.length > 0) {
		return { roots: [], dryRun, error: '--roots-from-env takes no root argument.' };
	}
	if (roots.length === 0) {
		roots = (env.MEDIA_LIBRARY_ROOTS ?? '')
			.split(path.delimiter)
			.map((root) => root.trim())
			.filter(Boolean);
	}
	if (roots.length === 0)
		return { roots, dryRun, error: 'No library root given and MEDIA_LIBRARY_ROOTS is empty.' };
	return { roots, dryRun, error: null };
}

function resolveFfprobe(env: Record<string, string | undefined>): string {
	if (env.FFPROBE_PATH?.trim()) return env.FFPROBE_PATH.trim();
	if (env.FFMPEG_PATH?.trim()) {
		const ffmpeg = env.FFMPEG_PATH.trim();
		const sibling = path.join(
			path.dirname(ffmpeg),
			path.basename(ffmpeg).replace(/ffmpeg/iu, 'ffprobe')
		);
		if (sibling !== ffmpeg) return sibling;
	}
	return 'ffprobe';
}

/** Prints the summary: counts and timings, and library-relative paths only for files needing attention. */
export function formatSummary(summary: ScanSummary): string {
	const lines = [
		`Library scan${summary.dryRun ? ' (dry run: nothing written)' : ''}`,
		`  roots ${summary.roots} (missing ${summary.missingRoots}) | videos ${summary.videosFound} | skipped: small ${summary.skippedSmall}, sample ${summary.skippedSample}, explicit ${summary.skippedExplicit}`,
		`  probe: ${summary.probed} probed, ${summary.probeReused} reused, ${summary.probeFailed} failed | sidecar subtitles ${summary.sidecarSubtitles}`,
		`  match: ${summary.matchedMovies} film files, ${summary.matchedEpisodes} episode files, ${summary.unmatched} unmatched, ${summary.ambiguous} ambiguous | TMDB searches ${summary.tmdbSearches}`,
		`  catalogue: ${summary.moviesIngested} films ${summary.dryRun ? 'to ingest' : 'ingested'}, ${summary.showsIngested} shows ${summary.dryRun ? 'to ingest' : 'ingested'}`,
		`  rows: ${summary.inserted} inserted, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.deleted} deleted`,
		`  timings (ms): ${Object.entries(summary.timingsMs)
			.map(([phase, ms]) => `${phase} ${ms}`)
			.join(', ')}`
	];
	if (summary.ambiguousFiles.length > 0) {
		lines.push('Ambiguous (pick by hand):');
		for (const file of summary.ambiguousFiles) lines.push(`  ${file.path} :: ${file.note}`);
	}
	if (summary.unmatchedFiles.length > 0) {
		lines.push('Unmatched:');
		for (const file of summary.unmatchedFiles) lines.push(`  ${file.path} :: ${file.note}`);
	}
	return lines.join('\n');
}

/** `scan-library` entry point; resolves to the process exit code. */
export async function runScanLibraryCommand(argv: string[]): Promise<number> {
	const args = parseScanArgs(argv, process.env);
	if (args.error) {
		console.error(args.error);
		console.error(SCAN_USAGE);
		return 1;
	}
	const ffprobe = resolveFfprobe(process.env);
	const check = spawnSync(ffprobe, ['-version'], {
		stdio: 'ignore',
		windowsHide: true,
		timeout: 15_000
	});
	if (check.status !== 0) {
		console.error('ffprobe is not available: set FFPROBE_PATH (or FFMPEG_PATH next to it).');
		return 1;
	}
	if (!process.env.TMDB_API_KEY && !process.env.TMDB_READ_TOKEN) {
		console.error('TMDB_API_KEY (or TMDB_READ_TOKEN) is required to match files.');
		return 1;
	}

	let db: WorkerDb | null = null;
	if (process.env.WORKER_DATABASE_URL?.trim()) db = getWorkerDatabase() as unknown as WorkerDb;
	else if (!args.dryRun) {
		console.error('WORKER_DATABASE_URL is required (or pass --dry-run).');
		return 1;
	}

	const http = new TmdbHttp();
	const started = Date.now();
	try {
		const summary = await scanLibrary(
			{ roots: args.roots, dryRun: args.dryRun },
			{
				db,
				matcher: new Matcher(createTmdbMatchSource(http)),
				probe: (file) => probeFile(file, ffprobe),
				ingestMovie: async (tmdbId) => {
					// The film ingest has its own TMDB client: pace it through the shared gate.
					await tmdbGate.wait();
					return ingestMovie(tmdbId);
				},
				ingestShow: (tmdbId, seasons) =>
					ingestTvShow(tmdbId, {
						seasons,
						db: db!,
						source: createTmdbTvSource(http),
						log: (message) => console.log(message)
					}),
				log: (message) => console.log(message)
			}
		);
		console.log(formatSummary(summary));
		console.log(
			`TMDB requests (search + TV): ${http.requestCount} | total ${Date.now() - started} ms`
		);
		return summary.missingRoots > 0 ? 2 : 0;
	} finally {
		await closeWorkerDatabase();
	}
}
