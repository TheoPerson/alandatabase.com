// Pure helpers for the movie detail page. Keep them free of server and DOM
// imports so loaders and components share one truth about trailers, key crew
// and watch providers.

import { isYouTubeKey } from '$lib/tmdb/images';

export interface VideoRow {
	key: string;
	site: string;
	type: string;
	name: string | null;
	official?: boolean | null;
	publishedAt?: string | Date | null;
}

export interface Trailer {
	key: string;
	name: string;
	type: 'Trailer' | 'Teaser';
	official: boolean;
}

const MAX_TRAILERS = 6;

function publishedTime(value: VideoRow['publishedAt']): number {
	if (!value) return 0;
	const time = new Date(value).getTime();
	return Number.isFinite(time) ? time : 0;
}

function isTrailerType(type: string): type is Trailer['type'] {
	return type === 'Trailer' || type === 'Teaser';
}

export function pickTrailers(videos: VideoRow[]): Trailer[] {
	return videos
		.filter(
			(video) => video.site === 'YouTube' && isTrailerType(video.type) && isYouTubeKey(video.key)
		)
		.sort((a, b) => {
			const official = Number(Boolean(b.official)) - Number(Boolean(a.official));
			if (official !== 0) return official;
			const type = Number(b.type === 'Trailer') - Number(a.type === 'Trailer');
			if (type !== 0) return type;
			return publishedTime(b.publishedAt) - publishedTime(a.publishedAt);
		})
		.slice(0, MAX_TRAILERS)
		.map((video) => ({
			key: video.key,
			name: video.name?.trim() || video.type,
			type: video.type as Trailer['type'],
			official: Boolean(video.official)
		}));
}

export interface CrewRow {
	job: string | null;
	department?: string | null;
	person: { id: string; name: string; profilePath?: string | null } | null;
}

export interface KeyCrewEntry {
	role: string;
	personId: string;
	name: string;
}

// Display role → TMDB jobs that fill it, in display order.
export const KEY_CREW_ROLES: Array<[role: string, jobs: string[]]> = [
	['Director', ['Director']],
	['Writer', ['Writer', 'Screenplay', 'Story', 'Novel']],
	['Cinematography', ['Director of Photography']],
	['Composer', ['Original Music Composer', 'Music']],
	['Editor', ['Editor']]
];

export function keyCrew(crew: CrewRow[]): KeyCrewEntry[] {
	const entries: KeyCrewEntry[] = [];
	for (const [role, jobs] of KEY_CREW_ROLES) {
		const match = crew.find((row) => row.person && row.job && jobs.includes(row.job));
		if (match?.person) entries.push({ role, personId: match.person.id, name: match.person.name });
	}
	return entries;
}

export interface ProviderRow {
	region: string;
	kind: string;
	providerId: number;
	providerName: string;
	logoPath: string | null;
	displayPriority: number;
	link: string | null;
}

export interface ProviderGroups {
	region: string;
	link: string | null;
	stream: ProviderRow[];
	free: ProviderRow[];
	rent: ProviderRow[];
	buy: ProviderRow[];
	empty: boolean;
}

function byPriority(a: ProviderRow, b: ProviderRow): number {
	return a.displayPriority - b.displayPriority || a.providerName.localeCompare(b.providerName);
}

function uniqueByProvider(rows: ProviderRow[]): ProviderRow[] {
	const seen = new Set<number>();
	return rows.filter((row) => {
		if (seen.has(row.providerId)) return false;
		seen.add(row.providerId);
		return true;
	});
}

export function groupProviders(rows: ProviderRow[], region: string): ProviderGroups {
	const local = rows.filter((row) => row.region === region);
	const pick = (...kinds: string[]) =>
		uniqueByProvider(local.filter((row) => kinds.includes(row.kind)).sort(byPriority));
	const stream = pick('flatrate');
	const free = pick('free', 'ads');
	const rent = pick('rent');
	const buy = pick('buy');
	return {
		region,
		link: local.find((row) => row.link)?.link ?? null,
		stream,
		free,
		rent,
		buy,
		empty: stream.length + free.length + rent.length + buy.length === 0
	};
}
