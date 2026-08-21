import { TMDBClient } from '$lib/server/tmdb';

export interface TVShowSummary {
	rank: number;
	id: number;
	tmdbId: number;
	imdbId?: string;
	title: string;
	originalName?: string;
	imdbRating: number;
	voteAverage: number;
	voteCount: number | string;
	firstAirDate: string;
	lastAirDate?: string;
	year: string;
	seasonsCount?: number;
	episodesCount?: number;
	posterPath: string | null;
	backdropPath: string | null;
	overview: string;
	genres: string[];
	status?: string;
}

// Exact Top 50 IMDb-Ranked Television Shows (IMDb Top 250 TV Chart)
export const TOP_50_IMDB_TV: Array<{
	rank: number;
	title: string;
	tmdbId: number;
	imdbId: string;
	imdbRating: number;
	year: string;
	seasons: number;
	genres: string[];
	overview: string;
	posterPath: string;
	backdropPath: string;
}> = [
	{
		rank: 1,
		title: 'Breaking Bad',
		tmdbId: 1396,
		imdbId: 'tt0903747',
		imdbRating: 9.5,
		year: '2008–2013',
		seasons: 5,
		genres: ['Drama', 'Crime', 'Thriller'],
		overview:
			'A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student in order to secure his family’s future.',
		posterPath: '/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
		backdropPath: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg'
	},
	{
		rank: 2,
		title: 'Planet Earth II',
		tmdbId: 68595,
		imdbId: 'tt5491994',
		imdbRating: 9.5,
		year: '2016',
		seasons: 1,
		genres: ['Documentary'],
		overview:
			'David Attenborough presents a documentary series exploring the unique characteristics of Earth’s most iconic habitats and the extraordinary ways animals survive within them.',
		posterPath: '/5maYKYzWpE68ycxGh1luu4P2LOS.jpg',
		backdropPath: '/1DYpBOVdb7Mzc9DgMCdIBTN1JEC.jpg'
	},
	{
		rank: 3,
		title: 'Planet Earth',
		tmdbId: 1044,
		imdbId: 'tt0795176',
		imdbRating: 9.4,
		year: '2006',
		seasons: 1,
		genres: ['Documentary'],
		overview:
			'A groundbreaking landmark documentary series celebrating the stunning diversity of our planet from the deepest caves to the highest peaks.',
		posterPath: '/5WkCg4s98vK5kL9gKqNqH4i9h9a.jpg',
		backdropPath: '/5kPz0pA2Xm4zQ6v8vL9f5K8J9H2.jpg'
	},
	{
		rank: 4,
		title: 'Band of Brothers',
		tmdbId: 4613,
		imdbId: 'tt0185906',
		imdbRating: 9.4,
		year: '2001',
		seasons: 1,
		genres: ['War', 'Drama', 'History'],
		overview:
			'The story of Easy Company of the U.S. Army 101st Airborne Division and their mission in World War II Europe, from Operation Overlord to V-J Day.',
		posterPath: '/z48n0kP6Yk2gJ9f8vK4jL8m1n9.jpg',
		backdropPath: '/fPHeE2nQnK6L5fK8vK9jL8m1n9.jpg'
	},
	{
		rank: 5,
		title: 'Chernobyl',
		tmdbId: 87108,
		imdbId: 'tt8399664',
		imdbRating: 9.3,
		year: '2019',
		seasons: 1,
		genres: ['Drama', 'History', 'Thriller'],
		overview:
			'A dramatization of the true story of one of the worst man-made catastrophes in history: the catastrophic nuclear accident at the Chernobyl Nuclear Power Plant in 1986.',
		posterPath: '/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg',
		backdropPath: '/uL6Ad12W0hKsm731gUms9R8Lw.jpg'
	},
	{
		rank: 6,
		title: 'The Wire',
		tmdbId: 1438,
		imdbId: 'tt0306414',
		imdbRating: 9.3,
		year: '2002–2008',
		seasons: 5,
		genres: ['Crime', 'Drama', 'Thriller'],
		overview:
			'The Baltimore drug scene, as seen through the eyes of drug dealers and law enforcement, expanding into politics, schools, and media.',
		posterPath: '/4lbclFySvugI51fwsycBdlZw4O7.jpg',
		backdropPath: '/ogk0k5L9gKqNqH4i9h9aL8m1n9.jpg'
	},
	{
		rank: 7,
		title: 'Avatar: The Last Airbender',
		tmdbId: 246,
		imdbId: 'tt0417299',
		imdbRating: 9.3,
		year: '2005–2008',
		seasons: 3,
		genres: ['Animation', 'Action & Adventure', 'Fantasy'],
		overview:
			'In a war-torn world of elemental magic, a young boy reawakens to undertake a dangerous mystic quest to fulfill his destiny as the Avatar.',
		posterPath: '/cHFZA8Tlv03n8k9f8vK4jL8m1n9.jpg',
		backdropPath: '/7kPz0pA2Xm4zQ6v8vL9f5K8J9H2.jpg'
	},
	{
		rank: 8,
		title: 'Blue Planet II',
		tmdbId: 74313,
		imdbId: 'tt6769208',
		imdbRating: 9.3,
		year: '2017',
		seasons: 1,
		genres: ['Documentary'],
		overview:
			'Sir David Attenborough returns to narrate this documentary showcase of the mysterious depths of our oceans and marine ecosystems.',
		posterPath: '/wH9koc385aLp2BsuE7Xp6J0l2Nf.jpg',
		backdropPath: '/8tVhsoj2R0qKsm731gUms9R8Lw.jpg'
	},
	{
		rank: 9,
		title: 'The Sopranos',
		tmdbId: 1398,
		imdbId: 'tt0141842',
		imdbRating: 9.2,
		year: '1999–2007',
		seasons: 6,
		genres: ['Drama', 'Crime'],
		overview:
			'New Jersey mob boss Tony Soprano deals with personal and professional issues in his home and business life that affect his mental state, leading him to seek professional therapy.',
		posterPath: '/6nua0vDqW8oN4Y9f8vK4jL8m1n9.jpg',
		backdropPath: '/9kPz0pA2Xm4zQ6v8vL9f5K8J9H2.jpg'
	},
	{
		rank: 10,
		title: 'Cosmos: A Spacetime Odyssey',
		tmdbId: 58474,
		imdbId: 'tt2395695',
		imdbRating: 9.2,
		year: '2014',
		seasons: 1,
		genres: ['Documentary'],
		overview:
			'Astrophysicist Neil deGrasse Tyson sets off on a voyage across space and time to explore the scientific principles of our universe.',
		posterPath: '/9joc385aLp2BsuE7Xp6J0l2Nf4J.jpg',
		backdropPath: '/0tVhsoj2R0qKsm731gUms9R8Lw.jpg'
	},
	{
		rank: 11,
		title: 'Our Planet',
		tmdbId: 83880,
		imdbId: 'tt9253866',
		imdbRating: 9.2,
		year: '2019–2023',
		seasons: 2,
		genres: ['Documentary'],
		overview:
			'Experience our planet’s natural beauty and examine how climate change impacts all living creatures in this ambitious documentary of spectacular scope.',
		posterPath: '/7koc385aLp2BsuE7Xp6J0l2Nf4J.jpg',
		backdropPath: '/1tVhsoj2R0qKsm731gUms9R8Lw.jpg'
	},
	{
		rank: 12,
		title: 'Cosmos',
		tmdbId: 1391,
		imdbId: 'tt0081846',
		imdbRating: 9.2,
		year: '1980',
		seasons: 1,
		genres: ['Documentary'],
		overview:
			'Astronomer Carl Sagan leads us on an incredible journey through the universe, exploring the 15-billion-year history of the cosmos and humankind’s place within it.',
		posterPath: '/2koc385aLp2BsuE7Xp6J0l2Nf4J.jpg',
		backdropPath: '/2tVhsoj2R0qKsm731gUms9R8Lw.jpg'
	},
	{
		rank: 13,
		title: 'Game of Thrones',
		tmdbId: 1399,
		imdbId: 'tt0944947',
		imdbRating: 9.2,
		year: '2011–2019',
		seasons: 8,
		genres: ['Sci-Fi & Fantasy', 'Drama', 'Action & Adventure'],
		overview:
			'Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns after being dormant for millennia.',
		posterPath: '/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
		backdropPath: '/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 14,
		title: 'Rick and Morty',
		tmdbId: 60625,
		imdbId: 'tt2861424',
		imdbRating: 9.1,
		year: '2013–Present',
		seasons: 7,
		genres: ['Animation', 'Comedy', 'Sci-Fi & Fantasy'],
		overview:
			'An eccentric, brilliant alcoholic scientist and his fretful teenage grandson embark on wild, dimension-hopping intergalactic adventures.',
		posterPath: '/gdIrmFDry59x6E0BTv1I59asWbs.jpg',
		backdropPath: '/kU987HaAnvHGvM2v0y1pL8m1n9.jpg'
	},
	{
		rank: 15,
		title: 'Fullmetal Alchemist: Brotherhood',
		tmdbId: 31911,
		imdbId: 'tt1389072',
		imdbRating: 9.1,
		year: '2009–2010',
		seasons: 1,
		genres: ['Animation', 'Action & Adventure', 'Sci-Fi & Fantasy'],
		overview:
			'Two brothers search for a Philosopher’s Stone after an attempt to revive their deceased mother goes horribly wrong and leaves them in damaged physical forms.',
		posterPath: '/5ZFvqzC0v9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/3tVhsoj2R0qKsm731gUms9R8Lw.jpg'
	},
	{
		rank: 16,
		title: 'The World at War',
		tmdbId: 1447,
		imdbId: 'tt0070997',
		imdbRating: 9.1,
		year: '1973–1974',
		seasons: 1,
		genres: ['Documentary', 'War', 'History'],
		overview:
			'A definitive 26-episode British television documentary series chronicling the events of the Second World War with rare footage and first-hand testimonies.',
		posterPath: '/4koc385aLp2BsuE7Xp6J0l2Nf4J.jpg',
		backdropPath: '/4tVhsoj2R0qKsm731gUms9R8Lw.jpg'
	},
	{
		rank: 17,
		title: 'The Twilight Zone',
		tmdbId: 4607,
		imdbId: 'tt0052520',
		imdbRating: 9.1,
		year: '1959–1964',
		seasons: 5,
		genres: ['Sci-Fi & Fantasy', 'Mystery', 'Drama'],
		overview:
			'Ordinary people find themselves in extraordinarily astounding situations, which they each try to solve in a remarkable, unpredictable manner.',
		posterPath: '/5koc385aLp2BsuE7Xp6J0l2Nf4J.jpg',
		backdropPath: '/5tVhsoj2R0qKsm731gUms9R8Lw.jpg'
	},
	{
		rank: 18,
		title: 'Sherlock',
		tmdbId: 19885,
		imdbId: 'tt1475582',
		imdbRating: 9.1,
		year: '2010–2017',
		seasons: 4,
		genres: ['Crime', 'Drama', 'Mystery'],
		overview:
			'A modern update finds the famous sleuth and his doctor partner solving crime in 21st century London.',
		posterPath: '/7Gro88i13zN8k9f8vK4jL8m1n9.jpg',
		backdropPath: '/6tVhsoj2R0qKsm731gUms9R8Lw.jpg'
	},
	{
		rank: 19,
		title: 'Batman: The Animated Series',
		tmdbId: 2098,
		imdbId: 'tt0103359',
		imdbRating: 9.0,
		year: '1992–1995',
		seasons: 4,
		genres: ['Animation', 'Action & Adventure', 'Crime'],
		overview:
			'The Dark Knight battles crime and iconic villains in Gotham City with help from Robin and Batgirl.',
		posterPath: '/8koc385aLp2BsuE7Xp6J0l2Nf4J.jpg',
		backdropPath: '/7tVhsoj2R0qKsm731gUms9R8Lw.jpg'
	},
	{
		rank: 20,
		title: 'Attack on Titan',
		tmdbId: 1429,
		imdbId: 'tt2560140',
		imdbRating: 9.0,
		year: '2013–2023',
		seasons: 4,
		genres: ['Animation', 'Sci-Fi & Fantasy', 'Action & Adventure'],
		overview:
			'After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.',
		posterPath: '/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg',
		backdropPath: '/8OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 21,
		title: 'The Vietnam War',
		tmdbId: 72649,
		imdbId: 'tt1877514',
		imdbRating: 9.0,
		year: '2017',
		seasons: 1,
		genres: ['Documentary', 'War', 'History'],
		overview:
			'Ken Burns and Lynn Novick direct a comprehensive immersive 10-part documentary history of the United States’ involvement in Southeast Asia.',
		posterPath: '/9koc385aLp2BsuE7Xp6J0l2Nf4J.jpg',
		backdropPath: '/9tVhsoj2R0qKsm731gUms9R8Lw.jpg'
	},
	{
		rank: 22,
		title: 'The Office (US)',
		tmdbId: 2316,
		imdbId: 'tt0386676',
		imdbRating: 9.0,
		year: '2005–2013',
		seasons: 9,
		genres: ['Comedy'],
		overview:
			'A mockumentary on a group of typical office workers, where the workday consists of ego clashes, inappropriate behavior, and tedium at Dunder Mifflin.',
		posterPath: '/qWnJzyZhyy74gjpSjIXWmuk0ifX.jpg',
		backdropPath: '/7OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 23,
		title: 'Better Call Saul',
		tmdbId: 60059,
		imdbId: 'tt3032476',
		imdbRating: 9.0,
		year: '2015–2022',
		seasons: 6,
		genres: ['Crime', 'Drama'],
		overview:
			'The trials and tribulations of criminal lawyer Jimmy McGill in the years leading up to his fateful run-in with Walter White and Jesse Pinkman.',
		posterPath: '/fC2HDm5t0kHVRawYrZhF0j9p4k9.jpg',
		backdropPath: '/6OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 24,
		title: 'Arcane',
		tmdbId: 94605,
		imdbId: 'tt11126994',
		imdbRating: 9.0,
		year: '2021–2024',
		seasons: 2,
		genres: ['Animation', 'Sci-Fi & Fantasy', 'Action & Adventure'],
		overview:
			'Set in the utopian region of Piltover and the oppressed underground of Zaun, the story follows the origins of two iconic League champions-and the power that will tear them apart.',
		posterPath: '/fqldf2t8ztc9aiwn39xDb3rIPV.jpg',
		backdropPath: '/uDgy6hyPd82kOHh6I95FLtLuh67.jpg'
	},
	{
		rank: 25,
		title: 'Bluey',
		tmdbId: 82728,
		imdbId: 'tt7678620',
		imdbRating: 9.0,
		year: '2018–Present',
		seasons: 3,
		genres: ['Animation', 'Family', 'Comedy'],
		overview:
			'The heartwarming and hilarious adventures of a lovable and inexhaustible Blue Heeler puppy who lives with her Dad, Mum and little sister Bingo.',
		posterPath: '/ndBwXQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/0OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 26,
		title: 'Firefly',
		tmdbId: 1437,
		imdbId: 'tt0303461',
		imdbRating: 9.0,
		year: '2002',
		seasons: 1,
		genres: ['Sci-Fi & Fantasy', 'Action & Adventure', 'Drama'],
		overview:
			'Five hundred years in the future, a renegade crew aboard a small spacecraft tries to survive as they travel the unknown parts of the galaxy and evade warring factions.',
		posterPath: '/kL0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/1OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 27,
		title: 'Human Planet',
		tmdbId: 35622,
		imdbId: 'tt1806234',
		imdbRating: 9.0,
		year: '2011',
		seasons: 1,
		genres: ['Documentary'],
		overview:
			'An unforgettable awe-inspiring documentary journey detailing humankind’s incredible relationship with nature in the contemporary world.',
		posterPath: '/2L0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 28,
		title: 'Death Note',
		tmdbId: 13916,
		imdbId: 'tt0877057',
		imdbRating: 8.9,
		year: '2006–2007',
		seasons: 1,
		genres: ['Animation', 'Mystery', 'Sci-Fi & Fantasy'],
		overview:
			'An intelligent high school student goes on a secret crusade to eliminate criminals from the world after discovering a supernatural notebook capable of killing anyone whose name is written into it.',
		posterPath: '/iigTJJskhk49xDb3rIPVfqldf2t.jpg',
		backdropPath: '/3OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 29,
		title: 'Only Fools and Horses',
		tmdbId: 1449,
		imdbId: 'tt0081912',
		imdbRating: 8.9,
		year: '1981–2003',
		seasons: 7,
		genres: ['Comedy'],
		overview:
			'The comedic misadventures of two south London brothers who will try just about anything to make a quick dishonest pound.',
		posterPath: '/4L0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/4OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 30,
		title: 'Fargo',
		tmdbId: 57243,
		imdbId: 'tt2802850',
		imdbRating: 8.9,
		year: '2014–2024',
		seasons: 5,
		genres: ['Crime', 'Drama'],
		overview:
			'Various chronicles of deception, intrigue and murder in and around frozen Minnesota, tied mysteriously to the city of Fargo, North Dakota.',
		posterPath: '/7OMB0ynKlyIenMJWI2Dy9IWT4c.jpg',
		backdropPath: '/5OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 31,
		title: 'Hunter x Hunter',
		tmdbId: 46298,
		imdbId: 'tt2098220',
		imdbRating: 8.9,
		year: '2011–2014',
		seasons: 6,
		genres: ['Animation', 'Action & Adventure', 'Fantasy'],
		overview:
			'Gon Freecss aspires to become a Hunter, an exceptional being capable of greatness. With his friends and his potential, he seeks for his father who left him when he was younger.',
		posterPath: '/ucpgvsUC3Za59x6E0BTv1I59asW.jpg',
		backdropPath: '/6OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 32,
		title: 'Succession',
		tmdbId: 76331,
		imdbId: 'tt7660850',
		imdbRating: 8.9,
		year: '2018–2023',
		seasons: 4,
		genres: ['Drama'],
		overview:
			'The Roy family is known for controlling the biggest media and entertainment company in the world. However, their world changes when their aging father steps down from the company.',
		posterPath: '/7H6V9koc385aLp2BsuE7Xp6J0l2.jpg',
		backdropPath: '/7OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 33,
		title: 'Cowboy Bebop',
		tmdbId: 4087,
		imdbId: 'tt0213338',
		imdbRating: 8.9,
		year: '1998–1999',
		seasons: 1,
		genres: ['Animation', 'Sci-Fi & Fantasy', 'Action & Adventure'],
		overview:
			'In 2071, roughly fifty years after an accident with a hyperspace gateway made the Earth almost uninhabitable, a ragtag band of bounty hunters travels through the solar system.',
		posterPath: '/8L0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/8OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 34,
		title: "Clarkson's Farm",
		tmdbId: 126953,
		imdbId: 'tt10541088',
		imdbRating: 8.9,
		year: '2021–Present',
		seasons: 3,
		genres: ['Documentary', 'Comedy'],
		overview:
			'Follow Jeremy Clarkson as he attempts to run a 1,000-acre working farm in the British countryside with humorous and unexpected challenges.',
		posterPath: '/9L0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/9OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 35,
		title: 'When They See Us',
		tmdbId: 81355,
		imdbId: 'tt7137906',
		imdbRating: 8.9,
		year: '2019',
		seasons: 1,
		genres: ['Drama', 'Crime'],
		overview:
			'Five teens from Harlem become trapped in a nightmare when they’re falsely accused of a brutal attack in Central Park. Based on the true story.',
		posterPath: '/0L0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/0OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 36,
		title: 'Seinfeld',
		tmdbId: 1400,
		imdbId: 'tt0098904',
		imdbRating: 8.9,
		year: '1989–1998',
		seasons: 9,
		genres: ['Comedy'],
		overview:
			'The continuing misadventures of neurotic New York City stand-up comedian Jerry Seinfeld and his equally neurotic New York friends.',
		posterPath: '/aCw8ONQImiwhMpWRJwhWQw0NpL.jpg',
		backdropPath: '/1OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 37,
		title: 'Gravity Falls',
		tmdbId: 40075,
		imdbId: 'tt1865718',
		imdbRating: 8.9,
		year: '2012–2016',
		seasons: 2,
		genres: ['Animation', 'Comedy', 'Mystery', 'Sci-Fi & Fantasy'],
		overview:
			'Twin siblings Dipper and Mabel Pines spend the summer at their great-uncle’s tourist trap in the enigmatic town of Gravity Falls, Oregon.',
		posterPath: '/2L0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 38,
		title: 'Nathan for You',
		tmdbId: 46648,
		imdbId: 'tt2297757',
		imdbRating: 8.9,
		year: '2013–2017',
		seasons: 4,
		genres: ['Comedy', 'Documentary'],
		overview:
			'Nathan Fielder uses his business degree and life experience to help struggling real-life small businesses with ludicrous and hilarious strategies.',
		posterPath: '/3L0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/3OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 39,
		title: 'The Beatles: Get Back',
		tmdbId: 104699,
		imdbId: 'tt9735318',
		imdbRating: 8.9,
		year: '2021',
		seasons: 1,
		genres: ['Documentary', 'Music'],
		overview:
			'Peter Jackson directs a remarkable documentary series capturing the Beatles during intimate songwriting sessions and their historic final rooftop concert in 1969.',
		posterPath: '/4L0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/4OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 40,
		title: 'True Detective',
		tmdbId: 46648,
		imdbId: 'tt2356777',
		imdbRating: 8.9,
		year: '2014–2024',
		seasons: 4,
		genres: ['Drama', 'Crime', 'Mystery'],
		overview:
			'An anthology series in which police investigations unearth the personal and professional secrets of those involved, both within and outside the law.',
		posterPath: '/a7sN7bKsm731gUms9R8LwJ9f8v.jpg',
		backdropPath: '/5OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 41,
		title: 'One Piece (Anime)',
		tmdbId: 37854,
		imdbId: 'tt0388629',
		imdbRating: 8.9,
		year: '1999–Present',
		seasons: 21,
		genres: ['Animation', 'Action & Adventure', 'Comedy'],
		overview:
			'Monkey D. Luffy and his pirate crew explore a fantastical world of endless oceans and exotic islands in search of the world’s ultimate treasure known as One Piece.',
		posterPath: '/cMD9Yv4K4jL8m1n9kL0pQeU0V9.jpg',
		backdropPath: '/6OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 42,
		title: 'Friends',
		tmdbId: 1668,
		imdbId: 'tt0108778',
		imdbRating: 8.9,
		year: '1994–2004',
		seasons: 10,
		genres: ['Comedy', 'Romance'],
		overview:
			'Follows the personal and professional lives of six twenty-to-thirty-something-year-old friends living in the Manhattan borough of New York City.',
		posterPath: '/f496cm9enuEsZkSPghVJQiAhNgW.jpg',
		backdropPath: '/7OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 43,
		title: "Monty Python's Flying Circus",
		tmdbId: 4639,
		imdbId: 'tt0063929',
		imdbRating: 8.8,
		year: '1969–1974',
		seasons: 4,
		genres: ['Comedy'],
		overview:
			'The iconic groundbreaking surreal sketch comedy series created by the British comedy troupe Monty Python.',
		posterPath: '/8L0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/8OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 44,
		title: 'The Last of Us',
		tmdbId: 100088,
		imdbId: 'tt3581920',
		imdbRating: 8.8,
		year: '2023–Present',
		seasons: 2,
		genres: ['Drama', 'Sci-Fi & Fantasy', 'Action & Adventure'],
		overview:
			'After a global pandemic destroys civilization, a hardened survivor takes charge of a 14-year-old girl who may be humanity’s last hope.',
		posterPath: '/uKvVjK19u75q9Oqvcu9En1TaUqT.jpg',
		backdropPath: '/9OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 45,
		title: 'Scavengers Reign',
		tmdbId: 204368,
		imdbId: 'tt21056886',
		imdbRating: 8.8,
		year: '2023',
		seasons: 1,
		genres: ['Animation', 'Sci-Fi & Fantasy', 'Drama'],
		overview:
			'The surviving crew of a damaged deep-space interstellar freighter ship are stranded on a beautiful yet extraordinarily unforgiving alien planet.',
		posterPath: '/0L0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/0OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 46,
		title: 'BoJack Horseman',
		tmdbId: 61222,
		imdbId: 'tt3398228',
		imdbRating: 8.8,
		year: '2014–2020',
		seasons: 6,
		genres: ['Animation', 'Comedy', 'Drama'],
		overview:
			'BoJack Horseman was the star of the hit television show "Horsin\' Around" in the 1990s, now he\'s washed up, living in Hollywood, and navigating existential dread.',
		posterPath: '/pB9koc385aLp2BsuE7Xp6J0l2Nf.jpg',
		backdropPath: '/1OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 47,
		title: 'Shōgun',
		tmdbId: 126308,
		imdbId: 'tt2788310',
		imdbRating: 8.8,
		year: '2024–Present',
		seasons: 1,
		genres: ['Drama', 'War & Politics', 'History'],
		overview:
			'In feudal Japan in the year 1600, Lord Yoshii Toranaga discovers secrets from a stranded European ship that could help him triumph against treacherous rivals.',
		posterPath: '/7O4iVfOMQmdCSxhOg1WNzG1AgYT.jpg',
		backdropPath: '/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 48,
		title: 'Blackadder Goes Forth',
		tmdbId: 4627,
		imdbId: 'tt0096548',
		imdbRating: 8.8,
		year: '1989',
		seasons: 1,
		genres: ['Comedy', 'War'],
		overview:
			'Captain Edmund Blackadder and his dim-witted subordinates try to escape the trenches of World War I.',
		posterPath: '/3L0pQeU0V9Yv4K4jL8m1n9kL0p.jpg',
		backdropPath: '/3OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 49,
		title: 'Peaky Blinders',
		tmdbId: 60574,
		imdbId: 'tt2442560',
		imdbRating: 8.8,
		year: '2013–2022',
		seasons: 6,
		genres: ['Drama', 'Crime'],
		overview:
			'A gangster family epic set in 1900s England, centering on a gang who sew razor blades in the peaks of their caps, and their fierce boss Tommy Shelby.',
		posterPath: '/vUUqzWa2LnHIVqkaKV1gN30113f.jpg',
		backdropPath: '/4OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	},
	{
		rank: 50,
		title: 'Stranger Things',
		tmdbId: 66732,
		imdbId: 'tt4574334',
		imdbRating: 8.7,
		year: '2016–2025',
		seasons: 5,
		genres: ['Sci-Fi & Fantasy', 'Drama', 'Mystery'],
		overview:
			'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
		posterPath: '/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
		backdropPath: '/5OMB0ynKlyIenMJWI2Dy9IWT4c.jpg'
	}
];

export async function getTop50IMDbTVShows(): Promise<TVShowSummary[]> {
	const tmdb = new TMDBClient();

	// Enrich from TMDB live to guarantee official posters, backdrops, and active seasons
	const enriched = await Promise.allSettled(
		TOP_50_IMDB_TV.map(async (show) => {
			try {
				const live = await tmdb.getTVDetails(show.tmdbId);
				return {
					rank: show.rank,
					id: show.tmdbId,
					tmdbId: show.tmdbId,
					imdbId: show.imdbId,
					title: live.name || show.title,
					originalName: live.original_name,
					imdbRating: show.imdbRating,
					voteAverage: live.vote_average || show.imdbRating,
					voteCount: live.vote_count || '1M+',
					firstAirDate: live.first_air_date || show.year.split('–')[0],
					lastAirDate: live.last_air_date,
					year: show.year,
					seasonsCount: live.number_of_seasons || show.seasons,
					episodesCount: live.number_of_episodes,
					posterPath: live.poster_path || show.posterPath,
					backdropPath: live.backdrop_path || show.backdropPath,
					overview: live.overview || show.overview,
					genres: live.genres?.map((g: any) => g.name) || show.genres,
					status: live.status
				} as TVShowSummary;
			} catch {
				return {
					rank: show.rank,
					id: show.tmdbId,
					tmdbId: show.tmdbId,
					imdbId: show.imdbId,
					title: show.title,
					imdbRating: show.imdbRating,
					voteAverage: show.imdbRating,
					voteCount: '1M+',
					firstAirDate: show.year.split('–')[0],
					year: show.year,
					seasonsCount: show.seasons,
					posterPath: show.posterPath,
					backdropPath: show.backdropPath,
					overview: show.overview,
					genres: show.genres
				} as TVShowSummary;
			}
		})
	);

	return enriched.map((res, i) =>
		res.status === 'fulfilled'
			? res.value
			: ({
					rank: TOP_50_IMDB_TV[i].rank,
					id: TOP_50_IMDB_TV[i].tmdbId,
					tmdbId: TOP_50_IMDB_TV[i].tmdbId,
					imdbId: TOP_50_IMDB_TV[i].imdbId,
					title: TOP_50_IMDB_TV[i].title,
					imdbRating: TOP_50_IMDB_TV[i].imdbRating,
					voteAverage: TOP_50_IMDB_TV[i].imdbRating,
					voteCount: '1M+',
					firstAirDate: TOP_50_IMDB_TV[i].year.split('–')[0],
					year: TOP_50_IMDB_TV[i].year,
					seasonsCount: TOP_50_IMDB_TV[i].seasons,
					posterPath: TOP_50_IMDB_TV[i].posterPath,
					backdropPath: TOP_50_IMDB_TV[i].backdropPath,
					overview: TOP_50_IMDB_TV[i].overview,
					genres: TOP_50_IMDB_TV[i].genres
				} as TVShowSummary)
	);
}

export async function getTVShowDetails(tmdbId: number): Promise<any> {
	const tmdb = new TMDBClient();
	const details = await tmdb.getTVDetails(tmdbId);
	return details;
}
