import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { schema } from '../db.js';
import {
	ingestTvShow,
	type TmdbSeasonDetail,
	type TmdbTvDetail,
	type WorkerDb
} from '../tv/ingest-tv.js';
import { Matcher, type MatchSource, type MovieCandidate, type TvCandidate } from './match.js';
import type { ProbeResult } from './probe.js';
import { scanLibrary, walkRoot, type ScanDependencies } from './scan.js';
import { createWorkerTestDatabase } from './test-db.js';

const KB = 1024;

class FakeSearch implements MatchSource {
	calls = 0;
	async searchMovie(query: string): Promise<MovieCandidate[]> {
		this.calls++;
		const movies: Record<string, MovieCandidate[]> = {
			'gladiator ii': [
				{
					id: 558449,
					title: 'Gladiator II',
					original_title: 'Gladiator II',
					release_date: '2024-11-13',
					popularity: 50,
					vote_count: 3000
				}
			],
			'adult test film': [
				{
					id: 777001,
					title: 'Adult Test Film',
					original_title: 'Adult Test Film',
					release_date: '2020-01-01',
					popularity: 5,
					vote_count: 50
				}
			]
		};
		return movies[query] ?? [];
	}
	async searchTv(query: string): Promise<TvCandidate[]> {
		this.calls++;
		return query === 'the pitt'
			? [
					{
						id: 250307,
						name: 'The Pitt',
						original_name: 'The Pitt',
						first_air_date: '2025-01-09',
						popularity: 90,
						vote_count: 400
					}
				]
			: [];
	}
}

const pitt: TmdbTvDetail = {
	id: 250307,
	name: 'The Pitt',
	adult: false,
	keywords: { results: [] },
	genres: [{ id: 18, name: 'Drama' }],
	seasons: [{ season_number: 1, episode_count: 2 }]
};
let pittEpisodes = [1, 2];
const pittSeason = (): TmdbSeasonDetail => ({
	season_number: 1,
	episodes: pittEpisodes.map((episode_number) => ({
		episode_number,
		name: `${episode_number + 6}:00 A.M.`
	}))
});

function probeResult(): ProbeResult {
	return {
		durationSeconds: 3600,
		video: {
			codec: 'hevc',
			profile: 'Main 10',
			pixFmt: 'yuv420p10le',
			width: 3840,
			height: 2160,
			hdr: 'hdr10'
		},
		audioTracks: [
			{ ordinal: 0, codec: 'eac3', channels: 6, language: 'fre', title: null, isDefault: true }
		],
		subtitleTracks: [
			{
				ordinal: 0,
				source: 'embedded',
				codec: 'subrip',
				language: 'fre',
				title: null,
				forced: true,
				isText: true
			}
		]
	};
}

describe('scanLibrary', () => {
	let pg: PGlite;
	let db: WorkerDb;
	let root: string;
	let search: FakeSearch;
	let probes: string[];
	let movieIngests: number[];
	let showIngests: Array<[number, number[]]>;

	function deps(): ScanDependencies {
		search = new FakeSearch();
		return {
			db,
			matcher: new Matcher(search),
			probe: async (file) => {
				probes.push(path.basename(file));
				return probeResult();
			},
			ingestMovie: async (tmdbId) => {
				movieIngests.push(tmdbId);
				const [row] = await db
					.insert(schema.movies)
					.values({ tmdbId, title: `Film ${tmdbId}`, adult: false })
					.returning({ id: schema.movies.id });
				return row.id;
			},
			ingestShow: (tmdbId, seasons) => {
				showIngests.push([tmdbId, seasons]);
				return ingestTvShow(tmdbId, {
					seasons,
					db,
					source: { getShow: async () => pitt, getSeason: async () => pittSeason() }
				});
			}
		};
	}

	const options = () => ({ roots: [root], minFilmBytes: 4 * KB, minEpisodeBytes: 2 * KB });

	before(async () => {
		({ pg, db } = await createWorkerTestDatabase());
		root = mkdtempSync(path.join(tmpdir(), 'alandb-scan-'));
		writeFileSync(
			path.join(root, 'Gladiator.II.2024.MULTi.2160p.WEB.H265-FW.mkv'),
			Buffer.alloc(6 * KB)
		);
		writeFileSync(
			path.join(root, 'Gladiator.II.2024.MULTi.2160p.WEB.H265-FW.fr.srt'),
			'1\n00:00:01,000 --> 00:00:02,000\nSalut\n'
		);
		mkdirSync(path.join(root, 'The.Pitt.S01.MULTi.1080p.WEB-GRP'));
		writeFileSync(
			path.join(
				root,
				'The.Pitt.S01.MULTi.1080p.WEB-GRP',
				'The.Pitt.S01E02.MULTi.1080p.WEB-GRP.mkv'
			),
			Buffer.alloc(3 * KB)
		);
		writeFileSync(
			path.join(
				root,
				'The.Pitt.S01.MULTi.1080p.WEB-GRP',
				'The.Pitt.S01E01.MULTi.1080p.WEB-GRP-sample.mkv'
			),
			Buffer.alloc(3 * KB)
		);
		writeFileSync(path.join(root, 'Tiny.Film.2020.mkv'), Buffer.alloc(KB));
		writeFileSync(path.join(root, 'someone.onlyfans.2023.mp4'), Buffer.alloc(6 * KB));
		writeFileSync(path.join(root, 'notes.txt'), 'not a video');
	});

	after(async () => {
		await pg.close();
		rmSync(root, { recursive: true, force: true });
	});

	beforeEach(() => {
		probes = [];
		movieIngests = [];
		showIngests = [];
	});

	it('walks one root, skipping samples, small files and non-videos, with sidecars', async () => {
		const walk = await walkRoot(root, { minFilmBytes: 4 * KB, minEpisodeBytes: 2 * KB });
		assert.equal(walk.ok, true);
		assert.deepEqual(
			walk.videos.map((video) => video.relativePath),
			[
				'Gladiator.II.2024.MULTi.2160p.WEB.H265-FW.mkv',
				'someone.onlyfans.2023.mp4',
				'The.Pitt.S01.MULTi.1080p.WEB-GRP/The.Pitt.S01E02.MULTi.1080p.WEB-GRP.mkv'
			].sort((a, b) => a.localeCompare(b))
		);
		assert.equal(walk.skippedSample, 1);
		assert.equal(walk.skippedSmall, 1);
		const film = walk.videos.find((video) => video.relativePath.startsWith('Gladiator'))!;
		assert.equal(film.sidecars.length, 1);
		assert.equal(film.sidecars[0].language, 'fre');
		assert.ok(path.isAbsolute(film.path));
	});

	it('dry-run reports what it would do without writing', async () => {
		const summary = await scanLibrary({ ...options(), dryRun: true }, deps());
		assert.equal(summary.inserted, 2);
		assert.equal(summary.skippedExplicit, 1);
		assert.deepEqual(movieIngests, []);
		assert.deepEqual(showIngests, []);
		assert.equal((await db.select().from(schema.mediaFiles)).length, 0);
	});

	it('stores matched files, ingesting the missing film and show seasons first', async () => {
		const summary = await scanLibrary(options(), deps());
		assert.equal(summary.videosFound, 3);
		assert.equal(summary.skippedExplicit, 1);
		assert.equal(summary.inserted, 2);
		assert.equal(summary.matchedMovies, 1);
		assert.equal(summary.matchedEpisodes, 1);
		assert.equal(summary.moviesIngested, 1);
		assert.equal(summary.showsIngested, 1);
		assert.deepEqual(movieIngests, [558449]);
		assert.deepEqual(showIngests, [[250307, [1]]]);
		assert.equal(probes.length, 2);

		const rows = await db.select().from(schema.mediaFiles);
		assert.equal(rows.length, 2);
		assert.ok(rows.every((row) => !/onlyfans/iu.test(row.path)));
		const film = rows.find((row) => row.movieId !== null)!;
		assert.equal(film.matchStatus, 'matched');
		assert.equal(film.episodeId, null);
		assert.equal(film.subtitleTracks.length, 2);
		assert.deepEqual(
			film.subtitleTracks.map((track) => [track.ordinal, track.source]),
			[
				[0, 'embedded'],
				[1, 'external']
			]
		);
		assert.equal(film.externalSubtitles[0].ordinal, 1);
		const episode = rows.find((row) => row.episodeId !== null)!;
		const [linked] = await db
			.select()
			.from(schema.tvEpisodes)
			.where(eq(schema.tvEpisodes.id, episode.episodeId!));
		assert.equal(linked.seasonNumber, 1);
		assert.equal(linked.episodeNumber, 2);
	});

	it('is idempotent: no probe, search, ingest or write on an unchanged library', async () => {
		const before = await db.select().from(schema.mediaFiles);
		const summary = await scanLibrary(options(), deps());
		assert.equal(summary.probed, 0);
		assert.equal(summary.probeReused, 2);
		assert.equal(summary.tmdbSearches, 0);
		assert.equal(search.calls, 0);
		assert.equal(summary.inserted + summary.updated + summary.deleted, 0);
		assert.equal(summary.unchanged, 2);
		assert.deepEqual(movieIngests, []);
		assert.deepEqual(showIngests, []);
		const afterRows = await db.select().from(schema.mediaFiles);
		assert.deepEqual(
			afterRows.map((row) => [row.id, row.updatedAt.getTime()]).sort(),
			before.map((row) => [row.id, row.updatedAt.getTime()]).sort()
		);
	});

	it('re-probes a changed file and keeps its id', async () => {
		const filmPath = path.join(root, 'Gladiator.II.2024.MULTi.2160p.WEB.H265-FW.mkv');
		const [beforeRow] = await db
			.select()
			.from(schema.mediaFiles)
			.where(eq(schema.mediaFiles.path, filmPath));
		appendFileSync(filmPath, Buffer.alloc(KB));
		const summary = await scanLibrary(options(), deps());
		assert.deepEqual(probes, ['Gladiator.II.2024.MULTi.2160p.WEB.H265-FW.mkv']);
		assert.equal(summary.updated, 1);
		const [afterRow] = await db
			.select()
			.from(schema.mediaFiles)
			.where(eq(schema.mediaFiles.path, filmPath));
		assert.equal(afterRow.id, beforeRow.id);
		assert.equal(afterRow.sizeBytes, 7 * KB);
	});

	it('keeps rows when a root is missing and deletes rows whose file vanished', async () => {
		const missing = await scanLibrary({ ...options(), roots: [path.join(root, 'nope')] }, deps());
		assert.equal(missing.missingRoots, 1);
		assert.equal(missing.deleted, 0);
		assert.equal((await db.select().from(schema.mediaFiles)).length, 2);

		unlinkSync(
			path.join(root, 'The.Pitt.S01.MULTi.1080p.WEB-GRP', 'The.Pitt.S01E02.MULTi.1080p.WEB-GRP.mkv')
		);
		const summary = await scanLibrary(options(), deps());
		assert.equal(summary.deleted, 1);
		const rows = await db.select().from(schema.mediaFiles);
		assert.equal(rows.length, 1);
		assert.ok(rows[0].movieId);
	});

	it('never links a file to a non-standard catalogue film', async () => {
		await db
			.insert(schema.movies)
			.values({ tmdbId: 777001, title: 'Adult Test Film', adult: true });
		writeFileSync(path.join(root, 'Adult.Test.Film.2020.1080p.mkv'), Buffer.alloc(6 * KB));
		const summary = await scanLibrary(options(), deps());
		assert.deepEqual(movieIngests, []);
		const [row] = await db
			.select()
			.from(schema.mediaFiles)
			.where(eq(schema.mediaFiles.path, path.join(root, 'Adult.Test.Film.2020.1080p.mkv')));
		assert.equal(row.movieId, null);
		assert.equal(row.matchStatus, 'unmatched');
		assert.match(row.matchNote ?? '', /not standard/u);
		assert.equal(summary.unmatchedFiles[0].path, 'Adult.Test.Film.2020.1080p.mkv');
	});

	it('unlinks a kept link once its film stops being standard content', async () => {
		const [film] = await db
			.select()
			.from(schema.mediaFiles)
			.where(eq(schema.mediaFiles.matchStatus, 'matched'));
		await db.update(schema.movies).set({ adult: true }).where(eq(schema.movies.id, film.movieId!));
		await scanLibrary(options(), deps());
		const [row] = await db
			.select()
			.from(schema.mediaFiles)
			.where(eq(schema.mediaFiles.id, film.id));
		assert.equal(row.movieId, null);
		assert.equal(row.matchStatus, 'unmatched');
	});

	it('fetches a missing episode from TMDB only once the show is no longer freshly synced', async () => {
		pittEpisodes = [1, 2, 3];
		const folder = path.join(root, 'The.Pitt.S01.MULTi.1080p.WEB-GRP');
		const file = path.join(folder, 'The.Pitt.S01E03.MULTi.1080p.WEB-GRP.mkv');
		writeFileSync(file, Buffer.alloc(3 * KB));
		await scanLibrary(options(), deps());
		assert.deepEqual(showIngests, []);
		let [row] = await db.select().from(schema.mediaFiles).where(eq(schema.mediaFiles.path, file));
		assert.equal(row.matchStatus, 'unmatched');
		assert.match(row.matchNote ?? '', /S01E03 is not on TMDB/u);

		await db
			.update(schema.tvShows)
			.set({ syncedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) })
			.where(eq(schema.tvShows.tmdbId, 250307));
		await scanLibrary(options(), deps());
		assert.deepEqual(showIngests, [[250307, [1]]]);
		[row] = await db.select().from(schema.mediaFiles).where(eq(schema.mediaFiles.path, file));
		assert.equal(row.matchStatus, 'matched');
		assert.ok(row.episodeId);
	});
});
