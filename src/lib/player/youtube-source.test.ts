import { describe, expect, it } from 'vitest';
import { createYouTubeSource, YOUTUBE_EMBED_ORIGIN } from './youtube-source';

describe('YouTube source', () => {
	it('rejects invalid keys before touching the DOM', () => {
		expect(() => createYouTubeSource('bad')).toThrow(/video key/u);
		expect(() => createYouTubeSource('https://evil.example/x')).toThrow(/video key/u);
	});

	it('starts idle with safe defaults and reports YouTube capabilities', () => {
		const source = createYouTubeSource('dQw4w9WgXcQ');

		expect(source.getState()).toMatchObject({
			status: 'idle',
			position: 0,
			duration: 0,
			rate: 1,
			volume: 1,
			muted: false,
			captions: false
		});
		expect(source.capabilities()).toMatchObject({
			pip: false,
			boost: false,
			captions: true,
			fullscreen: true,
			qualities: ['Auto']
		});
		expect(source.capabilities().rates).toContain(1);
		expect(YOUTUBE_EMBED_ORIGIN).toBe('https://www.youtube-nocookie.com');
	});

	it('control calls before load are harmless and state updates are observable', () => {
		const source = createYouTubeSource('dQw4w9WgXcQ');
		const seen: string[] = [];
		const off = source.on('state', (snapshot) => seen.push(`${snapshot.rate}:${snapshot.muted}`));

		expect(() => {
			source.play();
			source.pause();
			source.seek(10);
			source.setRate(1.5);
			source.setMuted(true);
			source.setCaptionSize('large');
		}).not.toThrow();
		expect(source.getState()).toMatchObject({ rate: 1.5, muted: true });
		expect(seen).toEqual(['1.5:false', '1.5:true']);

		off();
		source.setRate(1);
		expect(seen).toHaveLength(2);
		expect(() => source.destroy()).not.toThrow();
	});
});
