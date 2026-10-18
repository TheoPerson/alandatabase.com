import { describe, expect, it } from 'vitest';
import { parseLibraryRoots, readMediaConfig } from './config';
import {
	cacheDirConflicts,
	isInsideRoot,
	resolveInsideRoots,
	type CacheDirDeps,
	type PathDeps
} from './paths';

function winDeps(links: Record<string, string> = {}, missing: string[] = []): PathDeps {
	return {
		platform: 'win32',
		realpath: async (path: string) => {
			const key = path.replaceAll('/', '\\');
			if (missing.some((m) => key.toLowerCase() === m.toLowerCase())) {
				throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
			}
			for (const [from, to] of Object.entries(links)) {
				if (key.toLowerCase().startsWith(from.toLowerCase())) return to + key.slice(from.length);
			}
			return key;
		}
	};
}

describe('library roots configuration', () => {
	it('splits roots on the platform delimiter and new lines', () => {
		expect(parseLibraryRoots('F:/MOVIES;E:\\Series', ';')).toEqual(['F:/MOVIES', 'E:\\Series']);
		expect(parseLibraryRoots('/srv/a:/srv/b\n/srv/c', ':')).toEqual(['/srv/a', '/srv/b', '/srv/c']);
		expect(parseLibraryRoots('  ', ';')).toEqual([]);
		expect(parseLibraryRoots(undefined)).toEqual([]);
	});

	it('is disabled without roots and applies defaults otherwise', () => {
		expect(readMediaConfig({})).toBeNull();
		const config = readMediaConfig({ MEDIA_LIBRARY_ROOTS: 'F:/MOVIES' });
		expect(config?.ffmpegPath).toBe('ffmpeg');
		expect(config?.ffprobePath).toBe('ffprobe');
		expect(config?.cacheDir).toMatch(/alandb-media$/u);
		expect(
			readMediaConfig({
				MEDIA_LIBRARY_ROOTS: 'F:/MOVIES',
				FFMPEG_PATH: 'C:/ff/ffmpeg.exe',
				MEDIA_CACHE_DIR: 'D:/cache'
			})
		).toMatchObject({ ffmpegPath: 'C:/ff/ffmpeg.exe', cacheDir: 'D:/cache' });
	});
});

describe('isInsideRoot (Windows)', () => {
	const root = 'F:/MOVIES';
	it('accepts files below the root with any separator or case', () => {
		expect(isInsideRoot('F:\\MOVIES\\a.mkv', root, 'win32')).toBe(true);
		expect(isInsideRoot('f:/movies/Show/S01/a.mkv', root, 'win32')).toBe(true);
		expect(isInsideRoot('F:/MOVIES\\Show/../a.mkv', root, 'win32')).toBe(true);
	});

	it('rejects traversal, sibling prefixes, other drives and the root itself', () => {
		expect(isInsideRoot('F:\\MOVIES\\..\\Windows\\win.ini', root, 'win32')).toBe(false);
		expect(isInsideRoot('F:/MOVIES/../../secret.mkv', root, 'win32')).toBe(false);
		expect(isInsideRoot('F:\\MOVIES2\\a.mkv', root, 'win32')).toBe(false);
		expect(isInsideRoot('G:\\MOVIES\\a.mkv', root, 'win32')).toBe(false);
		expect(isInsideRoot('\\\\server\\share\\MOVIES\\a.mkv', root, 'win32')).toBe(false);
		expect(isInsideRoot('F:\\MOVIES', root, 'win32')).toBe(false);
		expect(isInsideRoot('F:\\MOVIES\\', root, 'win32')).toBe(false);
	});

	it('strips the long-path prefix before comparing', () => {
		expect(isInsideRoot('\\\\?\\F:\\MOVIES\\a.mkv', root, 'win32')).toBe(true);
		expect(isInsideRoot('\\\\?\\F:\\Other\\a.mkv', root, 'win32')).toBe(false);
	});
});

describe('cacheDirConflicts', () => {
	const roots = ['F:/MOVIES'];
	function deps(links: Record<string, string> = {}, existing: string[] = []): CacheDirDeps {
		return {
			platform: 'win32',
			realpathSync: (path: string) => {
				const key = path.replaceAll('/', '\\').replace(/\\$/u, '');
				for (const [from, to] of Object.entries(links)) {
					if (key.toLowerCase() === from.toLowerCase()) return to;
				}
				const known = ['F:\\MOVIES', 'F:\\', 'C:\\', 'C:\\Temp', ...existing];
				if (known.some((k) => k.toLowerCase() === key.toLowerCase())) return key;
				throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
			}
		};
	}

	it('rejects the library root itself, however it is spelled', () => {
		for (const dir of [
			'F:/MOVIES',
			'F:/MOVIES/',
			'f:\\movies',
			'F:/MOVIES.',
			'F:/MOVIES. ',
			'F:\\MOVIES\\.'
		]) {
			expect(cacheDirConflicts(dir, roots, deps()), dir).toBe(true);
		}
	});

	it('rejects a folder inside a root and a parent of a root (the drive)', () => {
		expect(cacheDirConflicts('F:/MOVIES/cache', roots, deps())).toBe(true);
		expect(cacheDirConflicts('F:/MOVIES/Show./cache', roots, deps())).toBe(true);
		expect(cacheDirConflicts('F:/', roots, deps())).toBe(true);
		expect(cacheDirConflicts('F:', roots, deps())).toBe(true);
	});

	it('accepts a cache elsewhere, including a sibling with a longer name', () => {
		expect(cacheDirConflicts('C:/Temp/alandb-media', roots, deps())).toBe(false);
		expect(cacheDirConflicts('F:/MOVIES2/cache', roots, deps())).toBe(false);
	});

	it('follows junctions of the cache folder (or of its nearest existing parent) and of the roots', () => {
		const junction = deps({ 'C:\\Temp\\link': 'F:\\MOVIES\\x' }, ['C:\\Temp\\link']);
		expect(cacheDirConflicts('C:/Temp/link/cache', roots, junction)).toBe(true);
		const rootLink = deps({ 'E:\\Lib': 'F:\\MOVIES' }, ['E:\\Lib']);
		expect(cacheDirConflicts('F:/MOVIES/c', ['E:/Lib'], rootLink)).toBe(true);
		expect(cacheDirConflicts('C:/Temp/cache', ['E:/Lib'], rootLink)).toBe(false);
	});

	it('is case-sensitive on POSIX', () => {
		const posix: CacheDirDeps = { platform: 'linux', realpathSync: (p) => p };
		expect(cacheDirConflicts('/srv/movies', ['/srv/movies'], posix)).toBe(true);
		expect(cacheDirConflicts('/srv/movies/c', ['/srv/movies'], posix)).toBe(true);
		expect(cacheDirConflicts('/srv', ['/srv/movies'], posix)).toBe(true);
		expect(cacheDirConflicts('/srv/Movies', ['/srv/movies'], posix)).toBe(false);
		expect(cacheDirConflicts('/tmp/cache', ['/srv/movies'], posix)).toBe(false);
	});
});

describe('isInsideRoot (POSIX)', () => {
	it('is case-sensitive and blocks traversal', () => {
		expect(isInsideRoot('/srv/movies/a.mkv', '/srv/movies', 'linux')).toBe(true);
		expect(isInsideRoot('/srv/Movies/a.mkv', '/srv/movies', 'linux')).toBe(false);
		expect(isInsideRoot('/srv/movies/../etc/passwd', '/srv/movies', 'linux')).toBe(false);
		expect(isInsideRoot('/srv/movies-old/a.mkv', '/srv/movies', 'linux')).toBe(false);
	});
});

describe('resolveInsideRoots', () => {
	it('returns the real path of a file inside a root', async () => {
		await expect(resolveInsideRoots('F:/MOVIES/a.mkv', ['F:/MOVIES'], winDeps())).resolves.toEqual({
			ok: true,
			realPath: 'F:\\MOVIES\\a.mkv'
		});
	});

	it('reports a vanished file as missing', async () => {
		const deps = winDeps({}, ['F:\\MOVIES\\gone.mkv']);
		await expect(resolveInsideRoots('F:/MOVIES/gone.mkv', ['F:/MOVIES'], deps)).resolves.toEqual({
			ok: false,
			reason: 'missing'
		});
	});

	it('rejects a lexically outside path without touching the disk', async () => {
		let touched = false;
		const deps: PathDeps = {
			platform: 'win32',
			realpath: async (p) => {
				touched = true;
				return p;
			}
		};
		await expect(
			resolveInsideRoots('F:/MOVIES/../Windows/x.mkv', ['F:/MOVIES'], deps)
		).resolves.toEqual({ ok: false, reason: 'outside' });
		await expect(resolveInsideRoots('C:/x.mkv', ['F:/MOVIES'], deps)).resolves.toEqual({
			ok: false,
			reason: 'outside'
		});
		expect(touched).toBe(false);
	});

	it('rejects a junction or link that escapes the root', async () => {
		const deps = winDeps({ 'F:\\MOVIES\\link': 'C:\\Users\\secret' });
		await expect(resolveInsideRoots('F:/MOVIES/link/a.mkv', ['F:/MOVIES'], deps)).resolves.toEqual({
			ok: false,
			reason: 'outside'
		});
	});

	it('accepts a link that stays inside another configured root', async () => {
		const deps = winDeps({ 'F:\\MOVIES\\more': 'E:\\Series' });
		await expect(
			resolveInsideRoots('F:/MOVIES/more/a.mkv', ['F:/MOVIES', 'E:/Series'], deps)
		).resolves.toEqual({ ok: true, realPath: 'E:\\Series\\a.mkv' });
	});

	it('rejects empty paths and NUL bytes', async () => {
		await expect(resolveInsideRoots('', ['F:/MOVIES'], winDeps())).resolves.toMatchObject({
			ok: false
		});
		await expect(
			resolveInsideRoots('F:/MOVIES/a.mkv\0.txt', ['F:/MOVIES'], winDeps())
		).resolves.toMatchObject({ ok: false, reason: 'outside' });
	});
});
