// Trailer resume positions: one localStorage entry per video key, expiring
// after 90 days, never more than 50 kept. Every storage call is guarded.

export const RESUME_PREFIX = 'player:pos:';
export const RESUME_TTL_MS = 90 * 86_400_000;
export const RESUME_MAX = 50;
const MIN_OFFER_SECONDS = 10;
const TAIL_SECONDS = 15;

export interface ResumePoint {
	position: number;
	duration: number;
}

interface StoredResume extends ResumePoint {
	at: number;
}

/** A position is worth offering only past 10 s and before the last 15 s. */
export function resumeOffer(position: number, duration: number): boolean {
	return duration > 0 && position >= MIN_OFFER_SECONDS && position < duration - TAIL_SECONDS;
}

export function resumeKey(videoKey: string): string {
	return `${RESUME_PREFIX}${videoKey}`;
}

function parse(raw: string | null | undefined): StoredResume | null {
	if (!raw) return null;
	try {
		const value = JSON.parse(raw) as Partial<StoredResume> | null;
		if (
			!value ||
			typeof value.position !== 'number' ||
			typeof value.duration !== 'number' ||
			typeof value.at !== 'number'
		) {
			return null;
		}
		return { position: value.position, duration: value.duration, at: value.at };
	} catch {
		return null;
	}
}

export function readResume(
	storage: Storage | null | undefined,
	videoKey: string,
	now: number
): ResumePoint | null {
	try {
		const stored = parse(storage?.getItem(resumeKey(videoKey)));
		if (!stored || now - stored.at > RESUME_TTL_MS) return null;
		return { position: stored.position, duration: stored.duration };
	} catch {
		return null;
	}
}

export function writeResume(
	storage: Storage | null | undefined,
	videoKey: string,
	position: number,
	duration: number,
	now: number
): void {
	try {
		const entry: StoredResume = { position, duration, at: now };
		storage?.setItem(resumeKey(videoKey), JSON.stringify(entry));
	} catch {
		// Unavailable storage simply means no resume.
	}
}

export function clearResume(storage: Storage | null | undefined, videoKey: string): void {
	try {
		storage?.removeItem(resumeKey(videoKey));
	} catch {
		// ignore
	}
}

export function listResume(
	storage: Storage | null | undefined
): Array<{ key: string; at: number }> {
	const entries: Array<{ key: string; at: number }> = [];
	try {
		if (!storage) return entries;
		for (let index = 0; index < storage.length; index += 1) {
			const key = storage.key(index);
			if (!key?.startsWith(RESUME_PREFIX)) continue;
			const stored = parse(storage.getItem(key));
			entries.push({ key, at: stored?.at ?? 0 });
		}
	} catch {
		// ignore
	}
	return entries;
}

/** Drops expired entries and keeps only the newest RESUME_MAX. */
export function pruneResume(storage: Storage | null | undefined, now: number): void {
	const entries = listResume(storage).sort((a, b) => b.at - a.at);
	entries.forEach((entry, index) => {
		if (index >= RESUME_MAX || now - entry.at > RESUME_TTL_MS) {
			try {
				storage?.removeItem(entry.key);
			} catch {
				// ignore
			}
		}
	});
}

/** Removes every saved position; returns how many were removed. */
export function clearAllResume(storage: Storage | null | undefined): number {
	const entries = listResume(storage);
	for (const entry of entries) {
		try {
			storage?.removeItem(entry.key);
		} catch {
			// ignore
		}
	}
	return entries.length;
}
