export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export interface ResponsiveImage {
	src: string;
	srcset: string;
	placeholder: string;
}

function isAbsolute(path: string): boolean {
	return path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:');
}

function normalizePath(path: string | null | undefined): string | null {
	if (typeof path !== 'string') return null;
	const trimmed = path.trim();
	if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
	return trimmed;
}

export function tmdbImageUrl(path: string | null | undefined, size: string): string | null {
	const normalized = normalizePath(path);
	if (!normalized) return null;
	if (isAbsolute(normalized)) return normalized;
	return `${TMDB_IMAGE_BASE}/${size}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

function responsiveSet(
	path: string | null | undefined,
	candidates: Array<[size: string, width: number]>,
	defaultSize: string,
	placeholderSize: string
): ResponsiveImage | null {
	const normalized = normalizePath(path);
	if (!normalized) return null;
	// Legacy custom rows may store a full URL: no TMDB size variants exist for those.
	if (isAbsolute(normalized)) return { src: normalized, srcset: '', placeholder: normalized };

	return {
		src: tmdbImageUrl(normalized, defaultSize) as string,
		srcset: candidates
			.map(([size, width]) => `${tmdbImageUrl(normalized, size)} ${width}w`)
			.join(', '),
		placeholder: tmdbImageUrl(normalized, placeholderSize) as string
	};
}

export function posterSrcSet(path: string | null | undefined): ResponsiveImage | null {
	return responsiveSet(
		path,
		[
			['w185', 185],
			['w342', 342],
			['w500', 500],
			['w780', 780]
		],
		'w342',
		'w92'
	);
}

export function backdropSrcSet(path: string | null | undefined): ResponsiveImage | null {
	return responsiveSet(
		path,
		[
			['w780', 780],
			['w1280', 1280],
			['original', 3840]
		],
		'w1280',
		'w300'
	);
}

export function logoSrcSet(path: string | null | undefined): ResponsiveImage | null {
	return responsiveSet(
		path,
		[
			['w300', 300],
			['w500', 500]
		],
		'w500',
		'w300'
	);
}

export function profileImageUrl(path: string | null | undefined): string | null {
	return tmdbImageUrl(path, 'w185');
}

const YOUTUBE_KEY = /^[A-Za-z0-9_-]{11}$/u;

export function isYouTubeKey(key: unknown): key is string {
	return typeof key === 'string' && YOUTUBE_KEY.test(key);
}

export function youtubeThumbnail(key: unknown): string | null {
	return isYouTubeKey(key) ? `https://i.ytimg.com/vi/${key}/hqdefault.jpg` : null;
}
