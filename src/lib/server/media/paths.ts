// Library path safety. A media file path comes only from the database (never from a request), and
// it is streamed only when its real path, after resolving "..", junctions and symbolic links,
// lies inside one of the configured library roots.

import { realpathSync as fsRealpathSync } from 'node:fs';
import { realpath as fsRealpath } from 'node:fs/promises';
import { posix, win32 } from 'node:path';

export type PathCheck =
	{ ok: true; realPath: string } | { ok: false; reason: 'outside' | 'missing' };

export interface PathDeps {
	realpath: (path: string) => Promise<string>;
	platform: NodeJS.Platform;
}

const defaultDeps: PathDeps = { realpath: (path) => fsRealpath(path), platform: process.platform };

function api(platform: NodeJS.Platform) {
	return platform === 'win32' ? win32 : posix;
}

/** Absolute, normalised form used for comparisons (case-insensitive on Windows). */
export function comparablePath(path: string, platform: NodeJS.Platform): string {
	const p = api(platform);
	let value = path;
	if (platform === 'win32') {
		value = value.replace(/^\\\\\?\\(?!UNC\\)/u, '').replace(/^\\\\\?\\UNC\\/u, '\\\\');
		// A bare drive ("F:") means the current folder on that drive, which cannot be resolved
		// off Windows. Treat it as the drive root: the widest folder it can stand for.
		if (/^[a-zA-Z]:$/u.test(value)) value += '\\';
	}
	let resolved = p.resolve(value);
	if (resolved.length > p.parse(resolved).root.length) {
		resolved = resolved.replace(/[\\/]+$/u, '');
	}
	return platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function isInsideRoot(path: string, root: string, platform: NodeJS.Platform): boolean {
	const p = api(platform);
	const child = comparablePath(path, platform);
	const base = comparablePath(root, platform);
	if (child === base) return false; // a root itself is a folder, never a playable file
	const prefix = base.endsWith(p.sep) ? base : base + p.sep;
	return child.startsWith(prefix);
}

export interface CacheDirDeps {
	platform: NodeJS.Platform;
	realpathSync: (path: string) => string;
}

const defaultCacheDeps: CacheDirDeps = {
	platform: process.platform,
	realpathSync: (path) => fsRealpathSync.native(path)
};

/** comparablePath, and on Windows without the trailing dots and spaces the OS ignores. */
function canonicalPath(path: string, platform: NodeJS.Platform): string {
	const value = comparablePath(path, platform);
	if (platform !== 'win32') return value;
	const root = win32.parse(value).root;
	const parts = value
		.slice(root.length)
		.split('\\')
		.map((part) => part.replace(/[. ]+$/u, ''))
		.filter(Boolean);
	return root + parts.join('\\');
}

/** Real path of `path`, or of its nearest existing parent with the missing tail appended. */
function realOrNearest(path: string, deps: CacheDirDeps): string {
	const p = api(deps.platform);
	let current = p.resolve(path);
	const tail: string[] = [];
	for (;;) {
		try {
			return p.join(deps.realpathSync(current), ...[...tail].reverse());
		} catch {
			const parent = p.dirname(current);
			if (parent === current) return p.resolve(path);
			tail.push(p.basename(current));
			current = parent;
		}
	}
}

function related(a: string, b: string, platform: NodeJS.Platform): boolean {
	const x = canonicalPath(a, platform);
	const y = canonicalPath(b, platform);
	return x === y || isInsideRoot(x, y, platform) || isInsideRoot(y, x, platform);
}

/**
 * Whether a cache folder would write into the read-only library: equal to a root, inside one or a
 * parent of one, compared lexically (case and trailing dots ignored on Windows) and again after
 * resolving junctions and links of the cache folder (or its nearest existing parent) and roots.
 */
export function cacheDirConflicts(
	cacheDir: string,
	roots: string[],
	deps: CacheDirDeps = defaultCacheDeps
): boolean {
	if (roots.some((root) => related(cacheDir, root, deps.platform))) return true;
	const realCache = realOrNearest(cacheDir, deps);
	return roots.some((root) => related(realCache, realOrNearest(root, deps), deps.platform));
}

function isMissing(error: unknown): boolean {
	const code = (error as NodeJS.ErrnoException | null)?.code;
	return code === 'ENOENT' || code === 'ENOTDIR';
}

/**
 * Resolves a library file path. Lexically outside every root -> 'outside' (without touching the
 * disk); vanished -> 'missing'; real path (junctions/links resolved) outside -> 'outside'.
 */
export async function resolveInsideRoots(
	path: string,
	roots: string[],
	deps: PathDeps = defaultDeps
): Promise<PathCheck> {
	if (!path || path.includes('\0')) return { ok: false, reason: 'outside' };
	if (!roots.some((root) => isInsideRoot(path, root, deps.platform))) {
		return { ok: false, reason: 'outside' };
	}
	let real: string;
	try {
		real = await deps.realpath(path);
	} catch (error) {
		if (isMissing(error)) return { ok: false, reason: 'missing' };
		throw error;
	}
	const realRoots = await Promise.all(
		roots.map(async (root) => {
			try {
				return await deps.realpath(root);
			} catch {
				return null;
			}
		})
	);
	const inside = realRoots.some((root) => root !== null && isInsideRoot(real, root, deps.platform));
	return inside ? { ok: true, realPath: real } : { ok: false, reason: 'outside' };
}
