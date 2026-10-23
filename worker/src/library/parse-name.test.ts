import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeTitle, parseMediaPath, type ParsedMediaName } from './parse-name.js';

type Expected = Partial<ParsedMediaName>;

function check(path: string, expected: Expected) {
	const parsed = parseMediaPath(path);
	for (const [key, value] of Object.entries(expected)) {
		assert.deepEqual(
			parsed[key as keyof ParsedMediaName],
			value,
			`${path}: ${key} = ${JSON.stringify(parsed[key as keyof ParsedMediaName])}`
		);
	}
}

const movie = (title: string, year: number | null): Expected => ({
	kind: 'movie',
	title,
	year,
	season: null,
	episode: null
});

const episode = (title: string, season: number, number: number, year: number | null = null) => ({
	kind: 'episode' as const,
	title,
	season,
	episode: number,
	year
});

describe('parseMediaPath: films (scene style)', () => {
	const cases: Array<[string, Expected]> = [
		[
			'13.Jours.13.Nuits.2025.FRENCH.VOF.WiTH.AD.1080p.WEBRip.AC3.5.1.H264-LiHDL.mkv',
			movie('13 Jours 13 Nuits', 2025)
		],
		[
			'Apex.2026.Multi.VF2.2160p.Webrip.HDR10.EAC3.Atmos.5.1.x265-Neostark.mkv',
			movie('Apex', 2026)
		],
		['Chien.51.2025.FRENCH.1080p.WEB.H265-SUPPLY.mkv', movie('Chien 51', 2025)],
		['Cocorico.2.2026.FRENCH.1080p.WEB.AC3.5.1.H265-TOXIC.mkv', movie('Cocorico 2', 2026)],
		[
			'Deadpool.and.Wolverine.2024.TRUEFRENCH.720p.WEBRip.DDP5.1.x264-MULTiViSiON.mkv',
			movie('Deadpool and Wolverine', 2024)
		],
		[
			'Gladiator.II.2024.MULTi.VF2.1080p.WEB.H265-FW/Gladiator.II.2024.MULTi.VF2.1080p.WEB.H265-FW.mkv',
			movie('Gladiator II', 2024)
		],
		[
			'L.Enfant.qui.mesurait.le.monde.2024.FRENCH.1080p.WEB.H265-FW.mkv',
			movie("L'Enfant qui mesurait le monde", 2024)
		],
		['Les.K.D.Or.2026.FRENCH.AD.1080p.WEB.H265-GL0P.mkv', movie("Les K D'Or", 2026)],
		[
			'Un ptit truc en plus 2024/Un.p.tit.truc.en.plus.2024.FRENCH.1080p.WEB.H265-FW.mkv',
			movie("Un p'tit truc en plus", 2024)
		],
		[
			'le.retour.du.grand.blond.1974.french.1080p.bluray.x264-rough.mkv',
			movie('le retour du grand blond', 1974)
		],
		[
			'Hiver.a.Sokcho.2025.FRENCH.VOF.WiTH.AD.1080p.WEB.Light.EAC3.5.1.H264-LiHDL.mkv',
			movie('Hiver a Sokcho', 2025)
		],
		[
			'Wake.Up.Dead.Man.A.Knives.Out.Mystery.2025.MULTi.VF2.1080p.WEB.H265-FW.mkv',
			movie('Wake Up Dead Man A Knives Out Mystery', 2025)
		],
		[
			'Train.Dreams.2025.MULTi.VFF.1080p.WEBrip.EAC3.5.1.x265-TyHD..mkv',
			movie('Train Dreams', 2025)
		],
		['The.Little.Things.2021.MULTi.WEBrip.1080p.x264_JiHEFF.mkv', movie('The Little Things', 2021)],
		[
			'Inside.the.Trustor.Scandal.2026.DOC.MULTi.AD.1080p.NF.WEB.SDR.H265-BYOR.mkv',
			movie('Inside the Trustor Scandal', 2026)
		],
		[
			'Lee.Cronins.The.Mummy.2026.MULTI.2160p.WEBRip.iT.DV.HDR10+.x265.EAC3.5.1.Atmos-Amen.mkv',
			movie('Lee Cronins The Mummy', 2026)
		],
		['Last.Breath.2025.1080p.WEB-DL.AAC5.1.x265-NeoNoir.mkv', movie('Last Breath', 2025)],
		['Madame.Web.2024.FRENCH.VF2.720p.WEB.H264-FW.mkv', movie('Madame Web', 2024)],
		['Some.Film.WEB.x264-GRP.mkv', movie('Some Film', null)],
		[
			'The Six,Triple,Eight,2024/The.Six.Triple.Eight.2024.MULTi.1080p.WEB.H265-FW.mkv',
			movie('The Six Triple Eight', 2024)
		]
	];
	for (const [path, expected] of cases) it(path, () => check(path, expected));
});

describe('parseMediaPath: films (human style)', () => {
	const cases: Array<[string, Expected]> = [
		[
			'Alien Resurrection (1997) Special Edition MULTi VFI 1080p 10bit HDLight BluRay AC3 5.1 x265-QTZ.mkv',
			movie('Alien Resurrection', 1997)
		],
		['A Most Violent Year 2014.mkv', movie('A Most Violent Year', 2014)],
		['Green Book (2018).mkv', movie('Green Book', 2018)],
		[
			'Fast & Furious 6 (2013) EXTENDED MULTi VFF 2160p 10bit 4KLight HDR BluRay x265 AAC 5.1-QTZ.mkv',
			movie('Fast & Furious 6', 2013)
		],
		['X-Men Origins - Wolverine (2009).mkv', movie('X-Men Origins - Wolverine', 2009)],
		['La French (2014)   1080p FR x264 ac3 mHDgz.mkv', movie('La French', 2014)],
		['La Cité de Dieu (2002) [1080] MULTi BluRay x264-PopHD.mkv', movie('La Cité de Dieu', 2002)],
		[
			'L.Outsider 2016 French DTS-AC3 1080p HDLight x264.GHT/L.Outsider 2016 French DTS-AC3 1080p HDLight x264.GHT.mkv',
			movie("L'Outsider", 2016)
		],
		['Dragons 1 (2010) VFF-VOA 1080p HDlight.x264~Tonyk~.mkv', movie('Dragons 1', 2010)],
		[
			'Star Wars, episode VII - Le Reveil de la force (2015) MULTi (VFF-VO-VFQ) [1080p] BluRay x264-PopHD (Star Wars - The Force Awakens).mkv',
			{
				...movie('Star Wars episode VII - Le Reveil de la force', 2015),
				alternateTitle: 'Star Wars - The Force Awakens'
			}
		],
		[
			'Le Prestige (2006) MULTi VFF 2160p 10bit 4KLight HDR BluRay x265 HE-AAC 5.1 - QTZ (The Prestige).mkv',
			{ ...movie('Le Prestige', 2006), alternateTitle: 'The Prestige' }
		],
		[
			'Star Wars Épisode I - La Menace fantôme (1999) [1080p BluRay] [FR(VFF)-EN] [x265 10-bit AC3] [GWEN].mkv',
			movie('Star Wars Épisode I - La Menace fantôme', 1999)
		],
		[
			'The Phoenician Scheme (2025) [1080p] [WEBRip] [x265] [10bit] [5.1] [YTS.MX]/The.Phoenician.Scheme.2025.1080p.WEBRip.x265.10bit.AAC5.1-[YTS.MX].mp4',
			movie('The Phoenician Scheme', 2025)
		],
		[
			"Plex Versions/Original Quality/Five Nights at Freddy's 2 (2025).mp4",
			movie("Five Nights at Freddy's 2", 2025)
		]
	];
	for (const [path, expected] of cases) it(path, () => check(path, expected));
});

describe('parseMediaPath: collection numbering and parts', () => {
	it('drops a leading collection number', () =>
		check(
			'Harry Potter/2 - Harry Potter et la Chambre des Secrets.mkv',
			movie('Harry Potter et la Chambre des Secrets', null)
		));
	it('keeps an accented, misspelled title as written', () =>
		check(
			"1 - Harry Potter à l'École des Sociers.mkv",
			movie("Harry Potter à l'École des Sociers", null)
		));
	it('reads a trailing part number as a hint', () =>
		check('Harry Potter/Harry Potter et les Reliques de la Mort - 1.mkv', {
			...movie('Harry Potter et les Reliques de la Mort', null),
			partHint: 1
		}));
	it('keeps a title that is a year', () =>
		check('1917.2019.MULTi.1080p.WEB.H265-FW.mkv', movie('1917', 2019)));
});

describe('parseMediaPath: episodes', () => {
	const cases: Array<[string, Expected]> = [
		['The.Rookie.S04E11.End.Game.MULTi.1080p.NF.WEB.DDP.AV1-BTT.mkv', episode('The Rookie', 4, 11)],
		[
			'The.Rookie.2018.S01E03.MULTI.VFF.1080p.WEBRip.EAC3.2.0.x264-DN55.mp4',
			episode('The Rookie', 1, 3, 2018)
		],
		['S.W.A.T.S08E07.MULTi.1080p.WEBRiP.x265-KAF.mkv', episode('S.W.A.T.', 8, 7)],
		['S.W.A.T.2017.S07E02.MULTi.1080p.WEBRiP.x265-KAF.mkv', episode('S.W.A.T.', 7, 2, 2017)],
		[
			'The.Last.Frontier.2025.S01E03.MULTi.1080p.WEB.H265-FW/The.Last.Frontier.2025.S01E03.MULTi.1080p.WEB.H265-FW.mkv',
			episode('The Last Frontier', 1, 3, 2025)
		],
		[
			'Smoke.2025.S01E07.MULTi.1080p.WEB.H265-FW/Smoke.2025.S01E07.MULTi.1080p.WEB.H265-FW.mkv',
			episode('Smoke', 1, 7, 2025)
		],
		["Stranger Things - S05E01 - Chapitre un - L'incursion.mkv", episode('Stranger Things', 5, 1)],
		[
			'The.Studio.S01.MULTI.AD.2160p.WEBRip.ATVP.DV.HDR10+.x265.EAC3.5.1.Atmos-Amen/The Studio - S01E10 - La présentation 2160p.DV.HDR.x265-Amen.mkv',
			episode('The Studio', 1, 10)
		],
		[
			'The.Pitt.S01.MULTi.1080p.MAX.WEBRiP.AAC5.1.x265-R3MiX/The.Pitt.S01E08.MULTi.1080p.MAX.WEBRiP.AAC5.1.x265-R3MiX/The.Pitt.S01E08.MULTi.1080p.MAX.WEBRiP.AAC5.1.x265-R3MiX.mkv',
			episode('The Pitt', 1, 8)
		],
		[
			'Saison 01/Le suicide français - Saison 1_S01E02_Episode 2.mp4',
			episode('Le suicide français', 1, 2)
		],
		[
			'Cauchemar.en.cuisine.avec.Philippe.Etchebest.S15E09.FRENCH.1080p.WEB.x264-BULiTT.mkv',
			episode('Cauchemar en cuisine avec Philippe Etchebest', 15, 9)
		],
		[
			'IT.Welcome.To.Derry.S01E01.MULTi.1080p.WEB.H265-TFA.mkv',
			episode('IT Welcome To Derry', 1, 1)
		],
		[
			'A.Knight.of.the.Seven.Kingdoms.S01E02.MULTi.SDR.2160p.HMAX.WEB.Atmos.H265-TyHD.mkv',
			episode('A Knight of the Seven Kingdoms', 1, 2)
		],
		['Man.on.Fire.S01E07.FiNAL.MULTi.1080p.WEB.x264-FW.mkv', episode('Man on Fire', 1, 7)],
		[
			'Alien.Earth.S01E02.MULTi.TRUEFRENCH.1080p.WEB-DL.H265-Slay3R.mkv',
			episode('Alien Earth', 1, 2)
		],
		[
			'Young.Sherlock.2026.S01.MULTi.VFF.1080p.WEB.H265-TyHD/Young.Sherlock.S01E06.MULTi.VFF.1080p.WEB.H265-TyHD.mkv',
			episode('Young Sherlock', 1, 6, 2026)
		],
		[
			'The.Newsroom.S01.MULTI.1080p.BluRay.DTS.x265-ONLY/The.Newsroom.S01E09.MULTI.1080p.BluRay.DTS.x265-ONLY.mkv',
			episode('The Newsroom', 1, 9)
		],
		[
			'Pax.Massilia.S02.FRENCH.1080p.WEBrip.EAC3.5.1.x265-TyHD/Pax.Massilia.S02E02.FRENCH.1080p.WEBrip.EAC3.5.1.x265-TyHD.mkv',
			episode('Pax Massilia', 2, 2)
		]
	];
	for (const [path, expected] of cases) it(path, () => check(path, expected));

	it('takes the first episode of a multi-episode file and notes it', () => {
		check('The.Office.S01E01E02.1080p.WEB.x264-GRP.mkv', {
			...episode('The Office', 1, 1),
			episodeEnd: 2
		});
		check('The.Office.S01E01-E02.1080p.WEB.x264-GRP.mkv', {
			...episode('The Office', 1, 1),
			episodeEnd: 2
		});
		check('The Office - S01E03-04 - Pilot.mkv', { ...episode('The Office', 1, 3), episodeEnd: 4 });
		assert.match(parseMediaPath('The.Office.S01E01E02.mkv').note ?? '', /multi-episode/u);
	});

	it('uses the season-pack folder when the file name is weak', () => {
		check('The.Pitt.S01.MULTi.1080p.MAX.WEBRiP-R3MiX/S01E04.mkv', episode('The Pitt', 1, 4));
		check('Severance/Season 2/S02E03.mkv', episode('Severance', 2, 3));
		check('Severance/Saison 2/Episode S02E05 1080p.mkv', episode('Severance', 2, 5));
	});
});

describe('parseMediaPath: excluded and unknown', () => {
	it('flags explicit names and never yields a searchable title', () => {
		for (const path of [
			'onlyfan.2023.someone.and.someone.xxx.vertical.mp4',
			'Plex Versions/Original Quality/OnlyFans Somebody Sextape Rq.mp4'
		]) {
			const parsed = parseMediaPath(path);
			assert.equal(parsed.explicit, true);
			assert.equal(parsed.kind, 'unknown');
			assert.equal(parsed.title, '');
		}
	});

	it('survives emoji and replacement characters', () => {
		const parsed = parseMediaPath('T1 vs GENG🔥LA FINALE DES WORLDS  TOP1 vs TOP2 LCK !.mp4');
		assert.equal(parsed.kind, 'movie');
		assert.equal(parsed.title, 'T1 vs GENG LA FINALE DES WORLDS TOP1 vs TOP2 LCK');
		assert.equal(parseMediaPath('Am�lie (2001).mkv').title, 'Am lie');
	});

	it('keeps words after the year when they are not tags (sports recordings)', () => {
		check(
			'Boxing.2025.Usyk.vs.Dubois.2.EN.1080p.WEB.H264-BOUBA.mkv',
			movie('Boxing Usyk vs Dubois 2', 2025)
		);
	});

	it('returns unknown for names without any title', () => {
		assert.equal(parseMediaPath('1080p.x265.mkv').kind, 'unknown');
	});
});

describe('normalizeTitle', () => {
	it('folds accents, case, punctuation and the ampersand', () => {
		assert.equal(
			normalizeTitle("Harry Potter à l'École des Sorciers"),
			'harry potter a l ecole des sorciers'
		);
		assert.equal(
			normalizeTitle('Star Wars: Episode III - Revenge of the Sith'),
			'star wars episode iii revenge of the sith'
		);
		assert.equal(normalizeTitle('Fast & Furious 6'), 'fast and furious 6');
		assert.equal(normalizeTitle('S.W.A.T.'), 'swat');
	});
});
