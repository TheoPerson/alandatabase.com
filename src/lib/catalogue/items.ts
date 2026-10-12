// Plain data shapes shared by the UI kit and the server loaders. Kept outside
// Svelte files so server code can import the types without touching components.

export interface PosterItem {
	id: string;
	href: string;
	title: string;
	posterPath: string | null;
	releaseDate?: string | null;
	rating?: number | string | null;
	genre?: string | null;
}

export interface HeroItem extends PosterItem {
	backdropPath: string | null;
	logoPath?: string | null;
	overview?: string | null;
	runtime?: number | null;
	genres?: string[];
}
