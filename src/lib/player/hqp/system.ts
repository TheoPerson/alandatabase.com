// Picture in Picture, AirPlay and element fullscreen (spec 7.12). WebKit's presentation mode is
// preferred on Apple devices; fullscreen is element fullscreen only (iPhone has none).

interface WebKitVideo {
	webkitSupportsPresentationMode?: (mode: string) => boolean;
	webkitSetPresentationMode?: (mode: string) => void;
	webkitPresentationMode?: string;
	webkitShowPlaybackTargetPicker?: () => void;
	webkitCurrentPlaybackTargetIsWireless?: boolean;
	webkitDisplayingFullscreen?: boolean;
}

export interface SystemState {
	pip: boolean;
	airplayAvailable: boolean;
	airplayActive: boolean;
	fullscreen: boolean; // element fullscreen (desktop, iPad)
	nativeFullscreen: boolean; // the browser's own video fullscreen (our UI is not visible)
}

const webkit = (video: HTMLVideoElement) => video as HTMLVideoElement & WebKitVideo;

function applePip(video: HTMLVideoElement): boolean {
	const v = webkit(video);
	return (
		typeof v.webkitSetPresentationMode === 'function' &&
		!!v.webkitSupportsPresentationMode?.('picture-in-picture')
	);
}

export async function togglePictureInPicture(video: HTMLVideoElement, doc: Document) {
	if (applePip(video)) {
		const v = webkit(video);
		const inPip = v.webkitPresentationMode === 'picture-in-picture';
		v.webkitSetPresentationMode!(inPip ? 'inline' : 'picture-in-picture');
		return;
	}
	if (doc.pictureInPictureElement === video) await doc.exitPictureInPicture();
	else await video.requestPictureInPicture?.();
}

export function showAirPlayPicker(video: HTMLVideoElement) {
	webkit(video).webkitShowPlaybackTargetPicker?.();
}

export async function toggleElementFullscreen(target: HTMLElement, doc: Document) {
	if (!doc.fullscreenEnabled) return;
	if (doc.fullscreenElement) await doc.exitFullscreen();
	else await target.requestFullscreen({ navigationUI: 'hide' });
}

/** Follows PiP, AirPlay and fullscreen; returns the cleanup. */
export function watchSystem(
	video: HTMLVideoElement,
	doc: Document,
	onChange: (state: SystemState) => void
): () => void {
	const v = webkit(video);
	let airplayAvailable = false;
	const read = (): SystemState => ({
		pip: doc.pictureInPictureElement === video || v.webkitPresentationMode === 'picture-in-picture',
		airplayAvailable,
		airplayActive: !!v.webkitCurrentPlaybackTargetIsWireless,
		fullscreen: !!doc.fullscreenElement,
		nativeFullscreen: v.webkitPresentationMode === 'fullscreen' || !!v.webkitDisplayingFullscreen
	});
	const emit = () => onChange(read());
	const onAvailability = (event: Event) => {
		airplayAvailable = (event as Event & { availability?: string }).availability === 'available';
		emit();
	};
	const videoEvents = [
		'enterpictureinpicture',
		'leavepictureinpicture',
		'webkitpresentationmodechanged',
		'webkitbeginfullscreen',
		'webkitendfullscreen',
		'webkitcurrentplaybacktargetiswirelesschanged'
	];
	const docEvents = ['fullscreenchange', 'webkitfullscreenchange'];
	for (const type of videoEvents) video.addEventListener(type, emit);
	for (const type of docEvents) doc.addEventListener(type, emit);
	video.addEventListener('webkitplaybacktargetavailabilitychanged', onAvailability);
	return () => {
		for (const type of videoEvents) video.removeEventListener(type, emit);
		for (const type of docEvents) doc.removeEventListener(type, emit);
		video.removeEventListener('webkitplaybacktargetavailabilitychanged', onAvailability);
	};
}
