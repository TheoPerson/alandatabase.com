// `pnpm media:index` - builds the keyframe index of every video file under MEDIA_LIBRARY_ROOTS so
// the first play of each file can already stream the original. Read-only on the library: files
// are only read (Matroska Cues, else an ffprobe packet scan at low priority, one file at a time);
// indexes go to MEDIA_CACHE_DIR. Options: --dry-run, --limit <n>.

import 'dotenv/config';
import { readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { BackgroundQueue } from './background';
import { readMediaConfig } from './config';
import { KeyframeIndexer } from './indexer';
import { readCachedIndex } from './keyframes';
import { cacheDirConflicts, resolveInsideRoots } from './paths';
import { runCommand } from './process';

const VIDEO = new Set(['.mkv', '.mp4', '.m4v', '.mov', '.webm', '.avi', '.ts', '.m2ts']);
const MIN_BYTES = 50 * 1024 * 1024;

async function* walk(dir: string): AsyncGenerator<string> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(path);
		else if (entry.isFile() && VIDEO.has(extname(entry.name).toLowerCase())) yield path;
	}
}

async function duration(ffprobePath: string, path: string): Promise<number | null> {
	const result = await runCommand(
		ffprobePath,
		['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
		{ timeoutMs: 60_000 }
	);
	const value = Number(result.stdout.trim());
	return result.code === 0 && Number.isFinite(value) && value > 0 ? value : null;
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const limitIndex = args.indexOf('--limit');
	const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : Infinity;

	const config = readMediaConfig(process.env);
	if (!config) {
		console.error('MEDIA_LIBRARY_ROOTS is not set.');
		process.exitCode = 1;
		return;
	}
	if (cacheDirConflicts(config.cacheDir, config.roots)) {
		console.error('MEDIA_CACHE_DIR must be outside the media library (the library is read-only).');
		process.exitCode = 1;
		return;
	}
	const indexer = new KeyframeIndexer({
		cacheDir: config.cacheDir,
		ffprobePath: config.ffprobePath,
		queue: new BackgroundQueue()
	});
	console.log(
		`Indexing ${config.roots.join(', ')} -> ${config.cacheDir}${dryRun ? ' (dry run)' : ''}`
	);

	const totals = { files: 0, cached: 0, cues: 0, scanned: 0, failed: 0 };
	const started = Date.now();
	for (const root of config.roots) {
		for await (const path of walk(root)) {
			if (totals.files >= limit) break;
			const check = await resolveInsideRoots(path, config.roots);
			if (!check.ok) continue;
			const info = await stat(check.realPath);
			if (info.size < MIN_BYTES) continue;
			totals.files++;
			const identity = { path: check.realPath, size: info.size, mtimeMs: info.mtimeMs };
			if (await readCachedIndex(config.cacheDir, identity)) {
				totals.cached++;
				continue;
			}
			if (dryRun) {
				console.log(`  would index ${path}`);
				continue;
			}
			const t = Date.now();
			const seconds = await duration(config.ffprobePath, check.realPath);
			const target = { ...identity, durationSeconds: seconds };
			let index = await indexer.quick(target);
			if (index) totals.cues++;
			else {
				index = await indexer.scan(target);
				if (index) totals.scanned++;
				else totals.failed++;
			}
			const how = index ? `${index.method}, ${index.keyframes.length} keyframes` : 'FAILED';
			console.log(`  ${((Date.now() - t) / 1000).toFixed(1).padStart(6)} s  ${how}  ${path}`);
		}
	}
	console.log(
		`Done in ${Math.round((Date.now() - started) / 1000)} s: ${totals.files} files, ${totals.cached} already indexed, ${totals.cues} from Matroska cues, ${totals.scanned} scanned with ffprobe, ${totals.failed} failed.`
	);
}

void main();
