import { PRIMARY_LINKS } from '../navigation/links';
import { canPreview, normalizeQuery, searchHref } from './query';
import type { SearchHit } from './results';
import type { SearchStatus } from './live-search';

// Turns the palette's raw state (query, recent searches, server answer) into the
// groups and rows it draws. Pure, so every state is covered by unit tests.

export const GO_TO_LINKS: ReadonlyArray<{ label: string; href: string }> = [
	...PRIMARY_LINKS.map(({ label, href }) => ({ label, href })),
	{ label: 'Library', href: '/my/films' },
	{ label: 'Status', href: '/status' }
];

/** Skeleton rows drawn while the first results load. */
export const PLACEHOLDER_ROWS = 4;

export type PaletteItem =
	| { kind: 'search'; value: 'search'; label: string; href: string; query: string }
	| { kind: 'recent'; value: string; label: string; href: string; query: string }
	| { kind: 'link'; value: string; label: string; href: string }
	| { kind: 'movie'; value: string; label: string; href: string; hit: SearchHit; query: string }
	| { kind: 'browse'; value: 'browse'; label: string; href: string }
	| { kind: 'clear'; value: 'clear-recent'; label: string }
	| { kind: 'retry'; value: 'retry'; label: string };

export interface PaletteGroup {
	id: 'recent' | 'goto' | 'movies' | 'series' | 'browse' | 'retry';
	heading: string | null;
	items: PaletteItem[];
}

export interface PaletteNote {
	tone: 'hint' | 'info' | 'error';
	text: string;
}

export interface PaletteModelInput {
	query: string;
	recents: string[];
	status: SearchStatus;
	hits: SearchHit[];
}

export interface PaletteModel {
	/** Rows above the groups: the "See all results" row while typing. */
	top: PaletteItem[];
	groups: PaletteGroup[];
	/** How many skeleton rows to draw. */
	placeholders: number;
	/** True while a request is pending: the list is `aria-busy`. */
	busy: boolean;
	note: PaletteNote | null;
	/** Polite live-region text; empty when the alert role already says it. */
	announcement: string;
}

function emptyQueryModel(recents: string[]): PaletteModel {
	const groups: PaletteGroup[] = [];
	if (recents.length > 0) {
		groups.push({
			id: 'recent',
			heading: 'Recent searches',
			items: [
				...recents.map((recent): PaletteItem => ({
					kind: 'recent',
					value: `recent:${recent}`,
					label: recent,
					href: searchHref(recent),
					query: recent
				})),
				{ kind: 'clear', value: 'clear-recent', label: 'Clear recent searches' }
			]
		});
	}
	groups.push({
		id: 'goto',
		heading: 'Go to',
		items: GO_TO_LINKS.map((link): PaletteItem => ({
			kind: 'link',
			value: `link:${link.href}`,
			label: link.label,
			href: link.href
		}))
	});
	return { top: [], groups, placeholders: 0, busy: false, note: null, announcement: '' };
}

function seriesGroup(hits: SearchHit[], query: string): PaletteGroup {
	return {
		id: 'series',
		heading: 'Series',
		items: hits.map((hit): PaletteItem => ({
			kind: 'movie',
			value: `series:${hit.id}`,
			label: hit.title,
			href: `/tv/${encodeURIComponent(hit.id)}`,
			hit,
			query
		}))
	};
}

// Films first, then series; a group appears only when it has matches.
function resultGroups(hits: SearchHit[], query: string): PaletteGroup[] {
	const films = hits.filter((hit) => hit.type !== 'series');
	const series = hits.filter((hit) => hit.type === 'series');
	const groups: PaletteGroup[] = [];
	if (films.length > 0) groups.push(filmGroup(films, query));
	if (series.length > 0) groups.push(seriesGroup(series, query));
	return groups;
}

function foundAnnouncement(hits: SearchHit[]): string {
	const series = hits.filter((hit) => hit.type === 'series').length;
	const films = hits.length - series;
	const parts: string[] = [];
	if (films > 0) parts.push(`${films} ${films === 1 ? 'film' : 'films'}`);
	if (series > 0) parts.push(`${series} series`);
	return `${parts.join(' and ')} found`;
}

function filmGroup(hits: SearchHit[], query: string): PaletteGroup {
	return {
		id: 'movies',
		heading: 'Movies',
		items: hits.map((hit): PaletteItem => ({
			kind: 'movie',
			value: `movie:${hit.id}`,
			label: hit.title,
			href: `/movies/${encodeURIComponent(hit.id)}`,
			hit,
			query
		}))
	};
}

export function buildPaletteModel({
	query: rawQuery,
	recents,
	status,
	hits
}: PaletteModelInput): PaletteModel {
	const query = normalizeQuery(rawQuery);
	if (!query) return emptyQueryModel(recents);

	const top: PaletteItem[] = [
		{
			kind: 'search',
			value: 'search',
			label: `See all results for “${query}”`,
			href: searchHref(query),
			query
		}
	];
	const model: PaletteModel = {
		top,
		groups: [],
		placeholders: 0,
		busy: false,
		note: null,
		announcement: ''
	};

	if (!canPreview(query)) {
		model.note = { tone: 'hint', text: 'Type at least 2 characters to preview films' };
		return model;
	}

	// A preview-able query that has not been answered yet is loading, whatever the
	// session reports during the debounce.
	if (status === 'idle' || status === 'loading') {
		model.busy = true;
		model.announcement = 'Searching…';
		if (hits.length > 0) model.groups.push(...resultGroups(hits, query));
		else model.placeholders = PLACEHOLDER_ROWS;
		return model;
	}

	if (status === 'error') {
		model.note = { tone: 'error', text: 'Search is unavailable right now' };
		model.groups.push({
			id: 'retry',
			heading: null,
			items: [{ kind: 'retry', value: 'retry', label: 'Try again' }]
		});
		return model;
	}

	if (hits.length === 0) {
		const text = `No films match “${query}”`;
		model.note = { tone: 'info', text };
		model.announcement = text;
		model.groups.push({
			id: 'browse',
			heading: null,
			items: [{ kind: 'browse', value: 'browse', label: 'Browse all films', href: '/movies' }]
		});
		return model;
	}

	model.groups.push(...resultGroups(hits, query));
	model.announcement = foundAnnouncement(hits);
	return model;
}
