import { describe, expect, it, vi } from 'vitest';
import {
	showAirPlayPicker,
	toggleElementFullscreen,
	togglePictureInPicture,
	watchSystem,
	type SystemState
} from './system';
import { createFakeMedia } from './testing/fake-media';

describe('picture in picture', () => {
	it('uses the standard API, entering then leaving', async () => {
		const media = createFakeMedia();
		const states: SystemState[] = [];
		const stop = watchSystem(media, media.doc as unknown as Document, (s) => states.push(s));
		await togglePictureInPicture(media, media.doc as unknown as Document);
		expect(states.at(-1)?.pip).toBe(true);
		await togglePictureInPicture(media, media.doc as unknown as Document);
		expect(states.at(-1)?.pip).toBe(false);
		stop();
	});

	it("prefers WebKit's presentation mode on Apple devices", async () => {
		const media = createFakeMedia();
		const modes: string[] = [];
		Object.assign(media, {
			webkitPresentationMode: 'inline',
			webkitSupportsPresentationMode: (mode: string) => mode === 'picture-in-picture',
			webkitSetPresentationMode(mode: string) {
				modes.push(mode);
				(this as { webkitPresentationMode: string }).webkitPresentationMode = mode;
				media.emit('webkitpresentationmodechanged');
			}
		});
		const requested = vi.spyOn(media.fake, 'requestPictureInPicture');
		const states: SystemState[] = [];
		watchSystem(media, media.doc as unknown as Document, (s) => states.push(s));
		await togglePictureInPicture(media, media.doc as unknown as Document);
		expect(states.at(-1)).toMatchObject({ pip: true, nativeFullscreen: false });
		await togglePictureInPicture(media, media.doc as unknown as Document);
		expect(modes).toEqual(['picture-in-picture', 'inline']);
		expect(requested).not.toHaveBeenCalled();
		(
			media as unknown as { webkitSetPresentationMode: (m: string) => void }
		).webkitSetPresentationMode('fullscreen');
		expect(states.at(-1)).toMatchObject({ pip: false, nativeFullscreen: true });
	});
});

describe('AirPlay', () => {
	it('reports availability and the wireless target, and opens the picker', () => {
		const media = createFakeMedia();
		const picker = vi.fn();
		Object.assign(media, {
			webkitShowPlaybackTargetPicker: picker,
			webkitCurrentPlaybackTargetIsWireless: false
		});
		const states: SystemState[] = [];
		const stop = watchSystem(media, media.doc as unknown as Document, (s) => states.push(s));
		const availability = new Event('webkitplaybacktargetavailabilitychanged');
		Object.assign(availability, { availability: 'available' });
		media.dispatchEvent(availability);
		expect(states.at(-1)).toMatchObject({ airplayAvailable: true, airplayActive: false });
		Object.assign(media, { webkitCurrentPlaybackTargetIsWireless: true });
		media.emit('webkitcurrentplaybacktargetiswirelesschanged');
		expect(states.at(-1)).toMatchObject({ airplayAvailable: true, airplayActive: true });
		showAirPlayPicker(media);
		expect(picker).toHaveBeenCalledOnce();
		stop();
		media.emit('webkitcurrentplaybacktargetiswirelesschanged');
		expect(states).toHaveLength(2);
		expect(() => showAirPlayPicker(createFakeMedia())).not.toThrow();
	});
});

describe('fullscreen', () => {
	it('toggles element fullscreen only when the document allows it', async () => {
		const media = createFakeMedia();
		const doc = media.doc;
		const target = {
			requestFullscreen: vi.fn(async () => {
				doc.fullscreenElement = target;
				doc.dispatchEvent(new Event('fullscreenchange'));
			})
		};
		const states: SystemState[] = [];
		watchSystem(media, doc as unknown as Document, (s) => states.push(s));
		await toggleElementFullscreen(target as unknown as HTMLElement, doc as unknown as Document);
		expect(states.at(-1)?.fullscreen).toBe(true);
		await toggleElementFullscreen(target as unknown as HTMLElement, doc as unknown as Document);
		expect(states.at(-1)?.fullscreen).toBe(false);
		doc.fullscreenEnabled = false;
		await toggleElementFullscreen(target as unknown as HTMLElement, doc as unknown as Document);
		expect(target.requestFullscreen).toHaveBeenCalledOnce();
	});
});
