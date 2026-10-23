// Chapter markers of a file (ffprobe -show_chapters reads only the header), cached in memory.

import { meaningfulChapterTitle } from '$lib/media/chapter-title';
import type { Chapter } from '$lib/media/types';
import { keyframeCacheKey, type FileIdentity } from './keyframes';
import { runCommand, type RunResult } from './process';

export function chaptersArgs(path: string): string[] {
	return ['-v', 'error', '-show_chapters', '-of', 'json', path];
}

export function parseChapters(json: string, durationSeconds: number | null): Chapter[] {
	let parsed: { chapters?: Array<Record<string, unknown>> };
	try {
		parsed = JSON.parse(json);
	} catch {
		return [];
	}
	const chapters: Chapter[] = [];
	for (const raw of parsed.chapters ?? []) {
		const start = Number(raw.start_time);
		let end = Number(raw.end_time);
		if (!Number.isFinite(start) || start < 0) continue;
		if (durationSeconds && (!Number.isFinite(end) || end > durationSeconds)) end = durationSeconds;
		if (!Number.isFinite(end) || end <= start) continue;
		const tags = (raw.tags ?? {}) as Record<string, unknown>;
		// Generated names ("(05)00:08:49:278", "Chapter 1") carry nothing: no title.
		const title = meaningfulChapterTitle(typeof tags.title === 'string' ? tags.title : null);
		chapters.push({ start: round(start), end: round(end), title });
	}
	return chapters.sort((a, b) => a.start - b.start);
}

function round(value: number): number {
	return Math.round(value * 1000) / 1000;
}

type Runner = (command: string, args: string[]) => Promise<RunResult>;

export class ChapterService {
	private readonly cache = new Map<string, Promise<Chapter[]>>();

	constructor(
		private readonly ffprobePath: string,
		private readonly run: Runner = (command, args) =>
			runCommand(command, args, { timeoutMs: 30_000 })
	) {}

	get(file: FileIdentity & { durationSeconds: number | null }): Promise<Chapter[]> {
		const key = keyframeCacheKey(file);
		let entry = this.cache.get(key);
		if (!entry) {
			entry = this.run(this.ffprobePath, chaptersArgs(file.path)).then((result) =>
				result.code === 0 ? parseChapters(result.stdout, file.durationSeconds) : []
			);
			this.cache.set(key, entry);
			void entry.then((chapters) => {
				if (chapters.length === 0) setTimeout(() => this.cache.delete(key), 60_000).unref?.();
			});
			if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value!);
		}
		return entry;
	}
}
