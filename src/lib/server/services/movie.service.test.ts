import { describe, it, expect } from 'vitest';
import { applyLocalOverrides } from './movie.service';

describe('Movie Service - Local Overrides', () => {
	it('should return the movie unchanged if there are no overrides', () => {
		const movie = {
			id: '123',
			title: 'Original Title',
			overview: 'Original Overview',
			localOverrides: null
		};

		const result = applyLocalOverrides(movie);

		expect(result.title).toBe('Original Title');
		expect(result.overview).toBe('Original Overview');
	});

	it('should apply local overrides when they exist', () => {
		const movie = {
			id: '123',
			title: 'Official Matrix',
			overview: 'Official Overview',
			localOverrides: {
				title: 'My Custom Matrix Title',
				overview: 'This is my personal overview for the movie.'
			}
		};

		const result = applyLocalOverrides(movie);

		expect(result.title).toBe('My Custom Matrix Title');
		expect(result.overview).toBe('This is my personal overview for the movie.');
		// The original fields are mutated, so the object itself is updated
	});

	it('should only apply specific overridden fields and leave others intact', () => {
		const movie = {
			id: '123',
			title: 'Official Matrix',
			releaseDate: '1999-03-31',
			overview: 'Official Overview',
			localOverrides: {
				title: 'My Custom Matrix Title'
				// releaseDate and overview are NOT overridden
			}
		};

		const result = applyLocalOverrides(movie);

		expect(result.title).toBe('My Custom Matrix Title');
		expect(result.releaseDate).toBe('1999-03-31');
		expect(result.overview).toBe('Official Overview');
	});
});
