import { describe, expect, it } from 'vitest';
import {
	backdropSrcSet,
	isYouTubeKey,
	logoSrcSet,
	posterSrcSet,
	profileImageUrl,
	tmdbImageUrl,
	youtubeThumbnail
} from './images';

describe('tmdbImageUrl', () => {
	it('builds a CDN URL for a TMDB path, with or without the leading slash', () => {
		expect(tmdbImageUrl('/abc.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
		expect(tmdbImageUrl('abc.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
	});

	it('passes absolute URLs through untouched and returns null for nothing', () => {
		expect(tmdbImageUrl('https://cdn.example/poster.jpg', 'w342')).toBe(
			'https://cdn.example/poster.jpg'
		);
		expect(tmdbImageUrl(null, 'w342')).toBeNull();
		expect(tmdbImageUrl('', 'w342')).toBeNull();
		expect(tmdbImageUrl('null', 'w342')).toBeNull();
	});
});

describe('responsive sets', () => {
	it('produces poster candidates from w185 to w780 with a w92 placeholder', () => {
		const image = posterSrcSet('/p.jpg');
		expect(image?.src).toBe('https://image.tmdb.org/t/p/w342/p.jpg');
		expect(image?.srcset).toBe(
			'https://image.tmdb.org/t/p/w185/p.jpg 185w, https://image.tmdb.org/t/p/w342/p.jpg 342w, https://image.tmdb.org/t/p/w500/p.jpg 500w, https://image.tmdb.org/t/p/w780/p.jpg 780w'
		);
		expect(image?.placeholder).toBe('https://image.tmdb.org/t/p/w92/p.jpg');
	});

	it('produces backdrop and logo candidates', () => {
		expect(backdropSrcSet('/b.jpg')?.srcset).toBe(
			'https://image.tmdb.org/t/p/w780/b.jpg 780w, https://image.tmdb.org/t/p/w1280/b.jpg 1280w, https://image.tmdb.org/t/p/original/b.jpg 3840w'
		);
		expect(backdropSrcSet('/b.jpg')?.placeholder).toBe('https://image.tmdb.org/t/p/w300/b.jpg');
		expect(logoSrcSet('/l.png')?.srcset).toBe(
			'https://image.tmdb.org/t/p/w300/l.png 300w, https://image.tmdb.org/t/p/w500/l.png 500w'
		);
		expect(profileImageUrl('/f.jpg')).toBe('https://image.tmdb.org/t/p/w185/f.jpg');
	});

	it('passes data URLs through for local kit samples', () => {
		const data = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>';
		expect(tmdbImageUrl(data, 'w342')).toBe(data);
		expect(backdropSrcSet(data)).toEqual({ src: data, srcset: '', placeholder: data });
	});

	it('returns null sets for missing paths', () => {
		expect(posterSrcSet(null)).toBeNull();
		expect(backdropSrcSet(undefined)).toBeNull();
	});

	it('does not build sets for absolute URLs (no size variants exist)', () => {
		const image = posterSrcSet('https://cdn.example/p.jpg');
		expect(image).toEqual({
			src: 'https://cdn.example/p.jpg',
			srcset: '',
			placeholder: 'https://cdn.example/p.jpg'
		});
	});
});

describe('YouTube helpers', () => {
	it('accepts only 11-character video ids', () => {
		expect(isYouTubeKey('dQw4w9WgXcQ')).toBe(true);
		expect(isYouTubeKey('dQw4w9WgXc')).toBe(false);
		expect(isYouTubeKey('dQw4w9WgXcQ"><script>')).toBe(false);
		expect(isYouTubeKey(null)).toBe(false);
	});

	it('builds a thumbnail only for a valid id', () => {
		expect(youtubeThumbnail('dQw4w9WgXcQ')).toBe(
			'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
		);
		expect(youtubeThumbnail('bad')).toBeNull();
	});
});
