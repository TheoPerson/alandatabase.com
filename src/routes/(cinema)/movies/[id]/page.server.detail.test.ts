import { beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
	getMovieById: vi.fn(),
	similarMovies: vi.fn(),
	collectionMovies: vi.fn(),
	getUserInteraction: vi.fn(),
	getUserMovieReviews: vi.fn()
}));

vi.mock('$lib/server/services/movie.service', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	getMovieById: services.getMovieById,
	similarMovies: services.similarMovies,
	collectionMovies: services.collectionMovies
}));
vi.mock('$lib/server/services/interaction.service', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	getUserInteraction: services.getUserInteraction,
	getUserMovieReviews: services.getUserMovieReviews
}));

import { load } from './+page.server';

const movie = {
	id: '00000000-0000-4000-8000-000000000001',
	tmdbId: 27205,
	imdbId: 'tt1375666',
	title: 'Inception',
	tagline: 'Your mind is the scene of the crime.',
	overview: 'A thief who steals corporate secrets.',
	posterPath: '/p.jpg',
	backdropPath: '/b.jpg',
	releaseDate: '2010-07-16',
	runtime: 148,
	voteAverage: '8.4',
	voteCount: 30000,
	originalTitle: 'Inception',
	originalLanguage: 'en',
	status: 'Released',
	budget: 160000000,
	revenue: 836836967,
	collectionId: null,
	collection: null,
	metadata: { logoPath: '/logo.png' },
	genres: [{ genre: { id: 28, name: 'Action' } }],
	cast: [
		{
			character: 'Cobb',
			person: { id: 'p1', name: 'Leonardo DiCaprio', profilePath: '/l.jpg' }
		}
	],
	crew: [
		{ job: 'Director', department: 'Directing', person: { id: 'p2', name: 'Christopher Nolan' } },
		{ job: 'Producer', department: 'Production', person: { id: 'p3', name: 'Emma Thomas' } }
	],
	videos: [
		{
			key: 'YoHD9XEInc0',
			site: 'YouTube',
			type: 'Trailer',
			name: 'Official Trailer',
			official: true,
			publishedAt: '2010-05-01'
		}
	],
	watchProviders: [
		{
			region: 'FR',
			kind: 'flatrate',
			providerId: 8,
			providerName: 'Netflix',
			logoPath: '/n.jpg',
			displayPriority: 1,
			link: 'https://tmdb/fr'
		}
	],
	keywordNames: ['dream', 'heist']
};

function call(params: { id: string }, user: { id: string; role: string } | null) {
	return load({ params, locals: { user } } as unknown as Parameters<typeof load>[0]);
}

describe('movie detail loader', () => {
	beforeEach(() => {
		for (const mock of Object.values(services)) mock.mockReset();
		services.similarMovies.mockResolvedValue([]);
		services.collectionMovies.mockResolvedValue([]);
		services.getUserInteraction.mockResolvedValue(null);
		services.getUserMovieReviews.mockResolvedValue([]);
	});

	it('shapes trailers, crew, providers, similar, details and personal state', async () => {
		services.getMovieById.mockResolvedValue(movie);
		services.similarMovies.mockResolvedValue([
			{ ...movie, id: '00000000-0000-4000-8000-000000000002', title: 'Tenet' }
		]);
		services.getUserInteraction.mockResolvedValue({
			watched: true,
			watchlist: false,
			favorite: false,
			rating: '4.5'
		});

		const data = await call({ id: movie.id }, { id: 'u', role: 'member' });

		expect(data.hero).toMatchObject({ id: movie.id, title: 'Inception', logoPath: '/logo.png' });
		expect(data.tagline).toBe(movie.tagline);
		expect(data.trailers.map((trailer) => trailer.key)).toEqual(['YoHD9XEInc0']);
		expect(data.keyCrew).toEqual([{ role: 'Director', personId: 'p2', name: 'Christopher Nolan' }]);
		expect(data.cast).toEqual([
			{ id: 'p1', name: 'Leonardo DiCaprio', profilePath: '/l.jpg', character: 'Cobb' }
		]);
		expect(data.crewByDepartment.map((group) => group.department)).toEqual([
			'Directing',
			'Production'
		]);
		expect(data.providers.FR.stream[0].providerName).toBe('Netflix');
		expect(data.providers.US.empty).toBe(true);
		expect(data.similar.map((item) => item.title)).toEqual(['Tenet']);
		expect(data.saga).toBeNull();
		expect(data.details).toMatchObject({
			releaseDate: '2010-07-16',
			runtime: 148,
			tmdbId: 27205,
			imdbId: 'tt1375666',
			keywords: ['dream', 'heist']
		});
		expect(data.interaction).toEqual({
			watched: true,
			watchlist: false,
			favorite: false,
			rating: 4.5
		});
		expect(data.user).toMatchObject({ id: 'u' });
		expect(services.similarMovies).toHaveBeenCalledWith(movie.id, 28);
		expect(services.getUserInteraction).toHaveBeenCalledWith('u', movie.id);
	});

	it('builds the saga from the collection and skips personal reads when signed out', async () => {
		services.getMovieById.mockResolvedValue({
			...movie,
			collectionId: 'c1',
			collection: { name: 'The Dark Knight Collection' }
		});
		services.collectionMovies.mockResolvedValue([
			{ ...movie, id: '00000000-0000-4000-8000-000000000003', title: 'Batman Begins' }
		]);

		const data = await call({ id: movie.id }, null);

		expect(data.saga).toEqual({
			name: 'The Dark Knight Collection',
			items: [expect.objectContaining({ title: 'Batman Begins' })]
		});
		expect(data.interaction).toBeNull();
		expect(data.user).toBeNull();
		expect(services.getUserInteraction).not.toHaveBeenCalled();
		expect(services.collectionMovies).toHaveBeenCalledWith('c1', movie.id);
	});

	it('degrades a failed similar read to an empty rail instead of failing the page', async () => {
		services.getMovieById.mockResolvedValue(movie);
		services.similarMovies.mockRejectedValue(new Error('database unavailable'));

		const data = await call({ id: movie.id }, null);

		expect(data.similar).toEqual([]);
		expect(data.hero.title).toBe('Inception');
	});

	it('preserves a not-found response', async () => {
		services.getMovieById.mockResolvedValue(null);

		await expect(call({ id: 'missing' }, null)).rejects.toMatchObject({ status: 404 });
	});

	it('maps unexpected service failures to a server error', async () => {
		services.getMovieById.mockRejectedValue(new Error('database unavailable'));

		await expect(call({ id: 'broken' }, null)).rejects.toMatchObject({ status: 500 });
	});
});
