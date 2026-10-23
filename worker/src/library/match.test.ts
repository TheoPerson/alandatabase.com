import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	Matcher,
	similarity,
	type MatchSource,
	type MovieCandidate,
	type TvCandidate
} from './match.js';
import { parseMediaPath } from './parse-name.js';

function movie(
	id: number,
	title: string,
	date: string,
	extra: Partial<MovieCandidate> = {}
): MovieCandidate {
	return {
		id,
		title,
		original_title: title,
		release_date: date,
		popularity: 10,
		vote_count: 100,
		...extra
	};
}

function show(
	id: number,
	name: string,
	date: string,
	extra: Partial<TvCandidate> = {}
): TvCandidate {
	return {
		id,
		name,
		original_name: name,
		first_air_date: date,
		popularity: 10,
		vote_count: 100,
		...extra
	};
}

class FakeSearch implements MatchSource {
	calls: string[] = [];
	constructor(
		private readonly movies: Record<string, MovieCandidate[]> = {},
		private readonly shows: Record<string, TvCandidate[]> = {}
	) {}
	async searchMovie(query: string, year: number | null, language: string) {
		this.calls.push(`movie:${query}:${year ?? ''}:${language}`);
		const all = this.movies[query.toLowerCase()] ?? [];
		return year === null
			? all
			: all.filter((m) => Math.abs(Number(m.release_date.slice(0, 4)) - year) <= 1);
	}
	async searchTv(query: string, year: number | null, language: string) {
		this.calls.push(`tv:${query}:${year ?? ''}:${language}`);
		const all = this.shows[query.toLowerCase()] ?? [];
		return year === null ? all : all.filter((s) => s.first_air_date.startsWith(String(year)));
	}
}

describe('similarity', () => {
	it('is 1 for equal normalised titles and tolerant to typos and punctuation', () => {
		assert.equal(similarity('Deadpool & Wolverine', 'Deadpool and Wolverine'), 1);
		assert.ok(
			similarity(
				"Harry Potter et le Prisonier d'Azkaban",
				"Harry Potter et le Prisonnier d'Azkaban"
			) > 0.9
		);
		assert.ok(similarity('HUNGER GAMES 5 CHALLENGERS VS 50 JOUEURS', 'The Hunger Games') < 0.5);
	});
});

describe('Matcher', () => {
	it('matches a film with its year and caches the answer', async () => {
		const source = new FakeSearch({
			'gladiator ii': [movie(558449, 'Gladiator II', '2024-11-13')],
			gladiator: [movie(98, 'Gladiator', '2000-05-01')]
		});
		const matcher = new Matcher(source);
		const parsed = parseMediaPath('Gladiator.II.2024.MULTi.VF2.1080p.WEB.H265-FW.mkv');
		const first = await matcher.match(parsed);
		const second = await matcher.match(parsed);
		assert.equal(first.status, 'matched');
		assert.equal(first.status === 'matched' && first.tmdbId, 558449);
		assert.deepEqual(second, first);
		assert.equal(source.calls.length, 1);
	});

	it('picks the right remake by year', async () => {
		const source = new FakeSearch({
			'the running man': [
				movie(865, 'The Running Man', '1987-11-13', { vote_count: 3000 }),
				movie(798645, 'The Running Man', '2025-11-12')
			]
		});
		const result = await new Matcher(source).match(
			parseMediaPath('The.Running.Man.2025.MULTi.mkv')
		);
		assert.equal(result.status === 'matched' && result.tmdbId, 798645);
	});

	it('falls back to the French title search and to shorter queries for typos', async () => {
		const source = new FakeSearch({
			"harry potter à l'école des sociers": [],
			"harry potter à l'école des": [
				movie(671, "Harry Potter à l'école des sorciers", '2001-11-16', {
					original_title: "Harry Potter and the Philosopher's Stone",
					vote_count: 28000
				}),
				movie(672, 'Harry Potter et la Chambre des secrets', '2002-11-13', {
					original_title: 'Harry Potter and the Chamber of Secrets'
				})
			]
		});
		const result = await new Matcher(source).match(
			parseMediaPath("1 - Harry Potter à l'École des Sociers.mkv")
		);
		assert.equal(result.status, 'matched');
		assert.equal(result.status === 'matched' && result.tmdbId, 671);
	});

	it('uses a part hint to separate two parts of the same title', async () => {
		const source = new FakeSearch({
			'harry potter et les reliques de la mort': [
				movie(12444, 'Harry Potter et les Reliques de la Mort : 1re partie', '2010-11-17'),
				movie(12445, 'Harry Potter et les Reliques de la Mort : 2e partie', '2011-07-07')
			]
		});
		const matcher = new Matcher(source);
		const part1 = await matcher.match(
			parseMediaPath('Harry Potter et les Reliques de la Mort - 1.mkv')
		);
		assert.equal(part1.status === 'matched' && part1.tmdbId, 12444);
		const noHint = await matcher.match(
			parseMediaPath('Harry Potter et les Reliques de la Mort.mkv')
		);
		assert.equal(noHint.status, 'ambiguous');
	});

	it('reports ambiguous when two equally good candidates exist', async () => {
		const source = new FakeSearch({
			'wake up': [movie(1, 'Wake Up', '2024-03-01'), movie(2, 'Wake Up', '2024-09-01')]
		});
		const result = await new Matcher(source).match(parseMediaPath('Wake.Up.2024.MULTi.1080p.mkv'));
		assert.equal(result.status, 'ambiguous');
		assert.equal(result.status === 'ambiguous' && result.candidates.length, 2);
	});

	it('prefers a candidate that dominates by votes over a same-title obscure one', async () => {
		const source = new FakeSearch({
			'wake up': [
				movie(1, 'Wake Up', '2024-03-01', { vote_count: 900 }),
				movie(2, 'Wake Up', '2024-09-01', { vote_count: 3 })
			]
		});
		const result = await new Matcher(source).match(parseMediaPath('Wake.Up.2024.MULTi.1080p.mkv'));
		assert.equal(result.status === 'matched' && result.tmdbId, 1);
	});

	it('leaves recordings and clips unmatched instead of forcing a weak match', async () => {
		const source = new FakeSearch({
			'hunger games 5 challengers vs 50 joueurs ils doivent survivre a toutes les vagues': [],
			'hunger games': [movie(70160, 'The Hunger Games', '2012-03-12')]
		});
		const result = await new Matcher(source).match(
			parseMediaPath(
				'HUNGER GAMES  5 CHALLENGERS VS 50 JOUEURS ! ILS DOIVENT SURVIVRE A TOUTES LES VAGUES !.mp4'
			)
		);
		assert.equal(result.status, 'unmatched');
	});

	it('never searches explicit or unknown names', async () => {
		const source = new FakeSearch();
		const result = await new Matcher(source).match(parseMediaPath('onlyfan.2023.someone.xxx.mp4'));
		assert.equal(result.status, 'unmatched');
		assert.deepEqual(source.calls, []);
	});

	it('drops adult candidates defensively', async () => {
		const source = new FakeSearch({ apex: [movie(9, 'Apex', '2026-01-01', { adult: true })] });
		const result = await new Matcher(source).match(parseMediaPath('Apex.2026.MULTi.mkv'));
		assert.equal(result.status, 'unmatched');
	});

	it('matches shows with first-air year and caches per show', async () => {
		const source = new FakeSearch(
			{},
			{
				's.w.a.t.': [
					show(71790, 'S.W.A.T.', '2017-11-02', { vote_count: 1500 }),
					show(2790, 'S.W.A.T.', '1975-02-24', { vote_count: 40 })
				],
				'the last frontier': [show(1, 'The Last Frontier', '2025-10-10')]
			}
		);
		const matcher = new Matcher(source);
		const a = await matcher.match(parseMediaPath('S.W.A.T.2017.S07E02.MULTi.mkv'));
		const b = await matcher.match(parseMediaPath('S.W.A.T.S08E07.MULTi.mkv'));
		const c = await matcher.match(parseMediaPath('S.W.A.T.S08E08.MULTi.mkv'));
		assert.equal(a.status === 'matched' && a.tmdbId, 71790);
		assert.equal(b.status === 'matched' && b.tmdbId, 71790);
		assert.deepEqual(c, b);
		const frontier = await matcher.match(parseMediaPath('The.Last.Frontier.2025.S01E03.mkv'));
		assert.equal(frontier.status === 'matched' && frontier.kind, 'tv');
		assert.equal(source.calls.filter((call) => call.startsWith('tv:s.w.a.t.')).length, 2);
	});

	it('matches "The Movie" names to a short TMDB title ("F1 The Movie" -> "F1® Le Film")', async () => {
		const source = new FakeSearch({
			'f1 the movie': [
				movie(911430, 'F1® Le Film', '2025-06-25', { original_title: 'F1', vote_count: 4800 })
			]
		});
		const result = await new Matcher(source).match(
			parseMediaPath('F1.The.Movie.2025.MULTi.VFF.AD.SDR.2160p.WEBrip.EAC3.5.1.x265-TyHD.mkv')
		);
		assert.equal(result.status === 'matched' && result.tmdbId, 911430);
	});

	it('accepts a TMDB title contained in a longer name only with the exact year', async () => {
		const original = movie(11, 'La Guerre des étoiles', '1977-05-25', {
			original_title: 'Star Wars'
		});
		const source = new FakeSearch({ 'star wars episode iv a new hope': [original] });
		const exact = await new Matcher(source).match(
			parseMediaPath('Star Wars Episode IV A New Hope (1977) Hybrid MULTi VFI 2160p 10bit.mkv')
		);
		assert.equal(exact.status === 'matched' && exact.tmdbId, 11);
		const offByYears = await new Matcher(source).match(
			parseMediaPath('Star Wars Episode IV A New Hope (1976) MULTi.mkv')
		);
		assert.equal(offByYears.status, 'unmatched');
		assert.ok(similarity('Star Wars Episode IV A New Hope', 'Star Wars') < 0.75);
	});

	it('takes a same-name show with five times the votes over obscure namesakes', async () => {
		const source = new FakeSearch(
			{},
			{
				countdown: [
					show(256317, 'Countdown', '2025-06-25', { vote_count: 153, popularity: 21.5 }),
					show(3863, 'Countdown', '1982-11-02', { vote_count: 20, popularity: 9.2 }),
					show(40841, 'Countdown', '2010-01-14', { vote_count: 0, popularity: 6.6 })
				]
			}
		);
		const result = await new Matcher(source).match(
			parseMediaPath('Countdown.S01E13.MULTi.VFF.1080p.WEB.H265-TyHD.mkv')
		);
		assert.equal(result.status === 'matched' && result.tmdbId, 256317);
	});

	it('stays ambiguous when the vote lead is small', async () => {
		const source = new FakeSearch(
			{},
			{
				countdown: [
					show(1, 'Countdown', '2025-06-25', { vote_count: 60, popularity: 10 }),
					show(2, 'Countdown', '1982-11-02', { vote_count: 20, popularity: 9 })
				]
			}
		);
		const result = await new Matcher(source).match(parseMediaPath('Countdown.S01E13.mkv'));
		assert.equal(result.status, 'ambiguous');
	});
});
