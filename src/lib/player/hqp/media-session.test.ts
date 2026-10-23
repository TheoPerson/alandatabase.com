import { describe, expect, it, vi } from 'vitest';
import type { HqpItem } from './types';
import { createMediaSessionBridge, mediaSessionArtwork } from './media-session';
import { FakeMediaSession, FakeWindow } from './testing/fake-media';

const item = {
	fileId: 'f1',
	kind: 'episode',
	title: 'Chapitre un',
	showTitle: 'Stranger Things',
	seasonNumber: 5,
	episodeNumber: 1,
	year: 2025,
	artwork: {
		stillPath: '/still.jpg',
		backdropPath: '/back.jpg',
		posterPath: '/p.jpg',
		logoPath: null
	}
} as unknown as HqpItem;

function setup() {
	const win = new FakeWindow();
	const session = win.navigator.mediaSession as FakeMediaSession;
	return { bridge: createMediaSessionBridge(win as unknown as Window), session };
}

describe('media session', () => {
	it('builds TMDB artwork at w780 and w1280 from the still, then the backdrop', () => {
		expect(mediaSessionArtwork(item.artwork)).toEqual([
			{ src: 'https://image.tmdb.org/t/p/w780/still.jpg', sizes: '780x439', type: 'image/jpeg' },
			{ src: 'https://image.tmdb.org/t/p/w1280/still.jpg', sizes: '1280x720', type: 'image/jpeg' }
		]);
		const film = { ...item.artwork, stillPath: null };
		expect(mediaSessionArtwork(film)[0].src).toBe('https://image.tmdb.org/t/p/w780/back.jpg');
		expect(
			mediaSessionArtwork({ stillPath: null, backdropPath: null, posterPath: null, logoPath: null })
		).toEqual([]);
	});

	it('sets metadata: title, show (or year) as artist, the HQP as album', () => {
		const { bridge, session } = setup();
		bridge.setItem(item);
		expect(session.metadata).toMatchObject({
			title: 'Chapitre un',
			artist: 'Stranger Things',
			album: "Alan's HQP"
		});
		bridge.setItem({ ...item, kind: 'movie', showTitle: null, title: 'Dune' } as HqpItem);
		expect(session.metadata).toMatchObject({ title: 'Dune', artist: '2025' });
	});

	it('wires play, pause, seek, chapter and next handlers; next is null without a next item', () => {
		const { bridge, session } = setup();
		const h = {
			play: vi.fn(),
			pause: vi.fn(),
			seekBy: vi.fn(),
			seekTo: vi.fn(),
			previous: vi.fn(),
			next: vi.fn()
		};
		bridge.setHandlers(h);
		const call = (action: string, details: Partial<MediaSessionActionDetails> = {}) =>
			session.handlers.get(action)?.({ action, ...details } as MediaSessionActionDetails);
		call('play');
		call('pause');
		call('seekbackward');
		call('seekforward', { seekOffset: 30 });
		call('seekto', { seekTime: 120 });
		call('previoustrack');
		call('nexttrack');
		expect(h.play).toHaveBeenCalledOnce();
		expect(h.pause).toHaveBeenCalledOnce();
		expect(h.seekBy.mock.calls).toEqual([[-10], [30]]);
		expect(h.seekTo).toHaveBeenCalledWith(120);
		expect(h.previous).toHaveBeenCalledOnce();
		expect(h.next).toHaveBeenCalledOnce();
		bridge.setHandlers({ ...h, next: null });
		expect(session.handlers.get('nexttrack')).toBeNull();
	});

	it('survives unsupported actions and invalid positions', () => {
		const { bridge, session } = setup();
		session.unsupported.add('seekto');
		const noop = () => {};
		expect(() =>
			bridge.setHandlers({
				play: noop,
				pause: noop,
				seekBy: noop,
				seekTo: noop,
				previous: noop,
				next: null
			})
		).not.toThrow();
		bridge.setPosition(100, 50, 1.5);
		bridge.setPosition(Number.NaN, 50, 1);
		bridge.setPosition(100, 140, 1);
		expect(session.positions).toEqual([
			{ duration: 100, position: 50, playbackRate: 1.5 },
			{ duration: 100, position: 100, playbackRate: 1 }
		]);
	});

	it('clears metadata, state and handlers', () => {
		const { bridge, session } = setup();
		bridge.setItem(item);
		bridge.setState('playing');
		expect(session.playbackState).toBe('playing');
		bridge.setHandlers({
			play: () => {},
			pause: () => {},
			seekBy: () => {},
			seekTo: () => {},
			previous: () => {},
			next: () => {}
		});
		bridge.clear();
		expect(session.metadata).toBeNull();
		expect(session.playbackState).toBe('none');
		expect([...session.handlers.values()].every((h) => h === null)).toBe(true);
	});

	it('is a no-op without the Media Session API', () => {
		const bridge = createMediaSessionBridge(null);
		expect(() => {
			bridge.setItem(item);
			bridge.setPosition(1, 0, 1);
			bridge.clear();
		}).not.toThrow();
	});
});
