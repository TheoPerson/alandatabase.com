import { db } from './index.js';
import { genres, movies, movieGenres } from './schema.js';

export const SEED_GENRES = [
	{ id: 28, name: 'Action' },
	{ id: 12, name: 'Adventure' },
	{ id: 16, name: 'Animation' },
	{ id: 35, name: 'Comedy' },
	{ id: 80, name: 'Crime' },
	{ id: 99, name: 'Documentary' },
	{ id: 18, name: 'Drama' },
	{ id: 10751, name: 'Family' },
	{ id: 14, name: 'Fantasy' },
	{ id: 36, name: 'History' },
	{ id: 27, name: 'Horror' },
	{ id: 10402, name: 'Music' },
	{ id: 9648, name: 'Mystery' },
	{ id: 10749, name: 'Romance' },
	{ id: 878, name: 'Science Fiction' },
	{ id: 10770, name: 'TV Movie' },
	{ id: 53, name: 'Thriller' },
	{ id: 10752, name: 'War' },
	{ id: 37, name: 'Western' }
];

export const SEED_MOVIES = [
	{
		tmdbId: 27205,
		imdbId: 'tt1375666',
		title: 'Inception',
		originalTitle: 'Inception',
		originalLanguage: 'en',
		overview:
			'Cobb, a skilled thief who steals corporate secrets through dream-sharing technology, is given the inverse task of planting an idea into the mind of a C.E.O., but his tragic past may doom the project.',
		tagline: 'Your mind is the scene of the crime.',
		posterPath: '/oYuLEW9W2iRuhx92GfaOSxKGhF5.jpg',
		backdropPath: '/8ZTVqvKDQ8emSGUEMjsS4yHAiWp.jpg',
		releaseDate: '2010-07-15',
		runtime: 148,
		popularity: '125.450',
		voteAverage: '8.40',
		voteCount: 35000,
		adult: false
	},
	{
		tmdbId: 157336,
		imdbId: 'tt0816692',
		title: 'Interstellar',
		originalTitle: 'Interstellar',
		originalLanguage: 'en',
		overview:
			'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.',
		tagline: 'Mankind was born on Earth. It was never meant to die here.',
		posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
		backdropPath: '/xJHokMbljvjADYdit5fK5VQsX2P.jpg',
		releaseDate: '2014-11-05',
		runtime: 169,
		popularity: '142.890',
		voteAverage: '8.40',
		voteCount: 34000,
		adult: false
	},
	{
		tmdbId: 238,
		imdbId: 'tt0068646',
		title: 'The Godfather',
		originalTitle: 'The Godfather',
		originalLanguage: 'en',
		overview:
			'Spanning the years 1945 to 1955, a chronicle of the fictional Italian-American Corleone crime family. When organized crime family patriarch, Vito Corleone bareley survives an attempt on his life, his youngest son, Michael steps in to take care of the would-be killers.',
		tagline: "An offer you can't refuse.",
		posterPath: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
		backdropPath: '/rSPw7tgCH9c6NqICZefy12pY12D.jpg',
		releaseDate: '1972-03-14',
		runtime: 175,
		popularity: '110.120',
		voteAverage: '8.70',
		voteCount: 19000,
		adult: false
	},
	{
		tmdbId: 155,
		imdbId: 'tt0468569',
		title: 'The Dark Knight',
		originalTitle: 'The Dark Knight',
		originalLanguage: 'en',
		overview:
			'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets. The partnership proves to be effective, but they soon find themselves prey to a reign of chaos unleashed by a rising criminal mastermind known to the terrified citizens of Gotham as the Joker.',
		tagline: 'Welcome to a world without rules.',
		posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
		backdropPath: '/dqK9Hag1054tghRQSqLSfrkrP2u.jpg',
		releaseDate: '2008-07-16',
		runtime: 152,
		popularity: '130.600',
		voteAverage: '8.50',
		voteCount: 32000,
		adult: false
	},
	{
		tmdbId: 680,
		imdbId: 'tt0110912',
		title: 'Pulp Fiction',
		originalTitle: 'Pulp Fiction',
		originalLanguage: 'en',
		overview:
			"A burger-loving hitman, his philosophical partner, a drug-addled gangster's moll and a washed-up boxer converge in this sprawling, comedic crime caper. Their adventures unfurl in three stories that ingeniously trip back and forth in time.",
		tagline: "Just because you're a character doesn't mean you have character.",
		posterPath: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
		backdropPath: '/suqC4WAtm0MKmPkBhCSpmFfqYvu.jpg',
		releaseDate: '1994-09-10',
		runtime: 154,
		popularity: '95.800',
		voteAverage: '8.50',
		voteCount: 27000,
		adult: false
	}
];

export async function seedInitialData() {
	// Seed Genres
	for (const g of SEED_GENRES) {
		await db.insert(genres).values(g).onConflictDoNothing();
	}

	// Seed Movies
	for (const m of SEED_MOVIES) {
		const [inserted] = await db.insert(movies).values(m).onConflictDoNothing().returning();

		if (inserted) {
			// Link default Sci-Fi / Drama genres
			await db
				.insert(movieGenres)
				.values({ movieId: inserted.id, genreId: 878 })
				.onConflictDoNothing();
			await db
				.insert(movieGenres)
				.values({ movieId: inserted.id, genreId: 18 })
				.onConflictDoNothing();
		}
	}
	console.log('🌱 Initial database seed completed.');
}
