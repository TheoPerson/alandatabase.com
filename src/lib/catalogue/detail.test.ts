import { describe, expect, it } from 'vitest';
import { groupProviders, keyCrew, pickTrailers } from './detail';

describe('pickTrailers', () => {
	it('keeps only YouTube videos with valid keys, official first, trailers before teasers, newest first', () => {
		const videos = [
			{ key: 'bad', site: 'YouTube', type: 'Trailer', name: 'Broken', official: true },
			{ key: 'vvvvvvvvvv1', site: 'Vimeo', type: 'Trailer', name: 'Vimeo', official: true },
			{
				key: 'tttttttttt1',
				site: 'YouTube',
				type: 'Teaser',
				name: 'Teaser A',
				official: true,
				publishedAt: '2024-01-01'
			},
			{
				key: 'oooooooooo1',
				site: 'YouTube',
				type: 'Trailer',
				name: 'Old official',
				official: true,
				publishedAt: '2023-01-01'
			},
			{
				key: 'nnnnnnnnnn1',
				site: 'YouTube',
				type: 'Trailer',
				name: 'New official',
				official: true,
				publishedAt: '2025-01-01'
			},
			{
				key: 'uuuuuuuuuu1',
				site: 'YouTube',
				type: 'Trailer',
				name: 'Unofficial',
				official: false,
				publishedAt: '2026-01-01'
			},
			{ key: 'cccccccccc1', site: 'YouTube', type: 'Clip', name: 'Clip', official: true }
		];

		expect(pickTrailers(videos).map((trailer) => trailer.name)).toEqual([
			'New official',
			'Old official',
			'Teaser A',
			'Unofficial'
		]);
	});

	it('caps at six and tolerates missing names and dates', () => {
		const many = Array.from({ length: 9 }, (_, index) => ({
			key: `k${String(index).padStart(10, '0')}`,
			site: 'YouTube',
			type: 'Trailer',
			name: null,
			official: true
		}));

		const picked = pickTrailers(many);

		expect(picked).toHaveLength(6);
		expect(picked[0].name).toBe('Trailer');
	});
});

describe('keyCrew', () => {
	it('returns one person per key role in a fixed order and skips unknown jobs', () => {
		const crew = [
			{ job: 'Producer', person: { id: 'p', name: 'Pat' } },
			{ job: 'Editor', person: { id: 'e', name: 'Eve' } },
			{ job: 'Director', person: { id: 'd', name: 'Dana' } },
			{ job: 'Director', person: { id: 'd2', name: 'Second Director' } },
			{ job: 'Original Music Composer', person: { id: 'm', name: 'Max' } },
			{ job: 'Writer', person: null }
		];

		expect(keyCrew(crew)).toEqual([
			{ role: 'Director', personId: 'd', name: 'Dana' },
			{ role: 'Composer', personId: 'm', name: 'Max' },
			{ role: 'Editor', personId: 'e', name: 'Eve' }
		]);
	});
});

describe('groupProviders', () => {
	const rows = [
		{
			region: 'FR',
			kind: 'flatrate',
			providerId: 8,
			providerName: 'Netflix',
			logoPath: '/n.jpg',
			displayPriority: 2,
			link: 'https://tmdb/fr'
		},
		{
			region: 'FR',
			kind: 'flatrate',
			providerId: 337,
			providerName: 'Disney+',
			logoPath: '/d.jpg',
			displayPriority: 1,
			link: 'https://tmdb/fr'
		},
		{
			region: 'FR',
			kind: 'free',
			providerId: 5,
			providerName: 'Free TV',
			logoPath: null,
			displayPriority: 1,
			link: 'https://tmdb/fr'
		},
		{
			region: 'FR',
			kind: 'ads',
			providerId: 5,
			providerName: 'Free TV',
			logoPath: null,
			displayPriority: 1,
			link: 'https://tmdb/fr'
		},
		{
			region: 'FR',
			kind: 'rent',
			providerId: 2,
			providerName: 'Apple TV',
			logoPath: '/a.jpg',
			displayPriority: 1,
			link: 'https://tmdb/fr'
		},
		{
			region: 'US',
			kind: 'buy',
			providerId: 2,
			providerName: 'Apple TV',
			logoPath: '/a.jpg',
			displayPriority: 1,
			link: 'https://tmdb/us'
		}
	];

	it('groups one region by kind, ordered by display priority, deduplicating free and ads', () => {
		const fr = groupProviders(rows, 'FR');

		expect(fr.stream.map((provider) => provider.providerName)).toEqual(['Disney+', 'Netflix']);
		expect(fr.free.map((provider) => provider.providerId)).toEqual([5]);
		expect(fr.rent.map((provider) => provider.providerName)).toEqual(['Apple TV']);
		expect(fr.buy).toEqual([]);
		expect(fr.link).toBe('https://tmdb/fr');
		expect(fr.empty).toBe(false);
	});

	it('reports an empty region honestly', () => {
		const de = groupProviders(rows, 'DE');

		expect(de.empty).toBe(true);
		expect(de.link).toBeNull();
	});
});
