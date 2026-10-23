export type NavIcon = 'home' | 'film' | 'tv' | 'search' | 'library' | 'compass' | 'sparkles';

export interface NavLink {
	href: string;
	label: string;
	icon: NavIcon;
	// Additional prefixes that count as "inside" this section.
	aliases?: string[];
}

export const PRIMARY_LINKS: NavLink[] = [
	{ href: '/', label: 'Home', icon: 'home' },
	{ href: '/movies', label: 'Movies', icon: 'film' },
	{ href: '/tv', label: 'TV', icon: 'tv', aliases: ['/tvshow', '/tvshows', '/shows'] },
	{ href: '/discover', label: 'Discover', icon: 'compass' },
	{ href: '/cinema/picker', label: 'Picker', icon: 'sparkles' }
];

export const TAB_LINKS: NavLink[] = [
	PRIMARY_LINKS[0],
	PRIMARY_LINKS[1],
	PRIMARY_LINKS[2],
	{ href: '/search', label: 'Search', icon: 'search' },
	{ href: '/my/films', label: 'Library', icon: 'library', aliases: ['/my'] }
];

function startsWithSegment(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isActivePath(pathname: string, href: string): boolean {
	if (href === '/') return pathname === '/';
	const link = [...PRIMARY_LINKS, ...TAB_LINKS].find((candidate) => candidate.href === href);
	const prefixes = [href, ...(link?.aliases ?? [])];
	return prefixes.some((prefix) => startsWithSegment(pathname, prefix));
}
