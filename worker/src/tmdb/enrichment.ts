// Pure selection logic for optional TMDB enrichment data. Kept free of I/O so the
// worker's safety tests can pin every input shape TMDB is known to send.

export const WATCH_PROVIDER_REGIONS = ['FR', 'US'] as const;
export const WATCH_PROVIDER_KINDS = ['flatrate', 'free', 'ads', 'rent', 'buy'] as const;
export type WatchProviderKind = (typeof WATCH_PROVIDER_KINDS)[number];

export interface TMDBWatchProvider {
	provider_id: number;
	provider_name: string;
	logo_path?: string | null;
	display_priority?: number;
}

export type TMDBWatchProviderRegion = { link?: string } & Partial<
	Record<WatchProviderKind, TMDBWatchProvider[]>
>;

export interface TMDBLogo {
	file_path: string;
	iso_639_1: string | null;
	vote_average?: number;
}

export interface WatchProviderRow {
	region: string;
	kind: WatchProviderKind;
	providerId: number;
	providerName: string;
	logoPath: string | null;
	displayPriority: number;
	link: string | null;
}

export function selectWatchProviderRows(
	results: Record<string, TMDBWatchProviderRegion> | undefined,
	regions: readonly string[] = WATCH_PROVIDER_REGIONS
): WatchProviderRow[] {
	if (!results) return [];
	const rows: WatchProviderRow[] = [];

	for (const region of regions) {
		const entry = results[region];
		if (!entry) continue;
		const link = typeof entry.link === 'string' ? entry.link : null;

		for (const kind of WATCH_PROVIDER_KINDS) {
			for (const provider of entry[kind] ?? []) {
				if (
					!Number.isInteger(provider?.provider_id) ||
					typeof provider.provider_name !== 'string'
				) {
					continue;
				}
				rows.push({
					region,
					kind,
					providerId: provider.provider_id,
					providerName: provider.provider_name,
					logoPath: typeof provider.logo_path === 'string' ? provider.logo_path : null,
					displayPriority: Number.isInteger(provider.display_priority)
						? (provider.display_priority as number)
						: 0,
					link
				});
			}
		}
	}

	return rows;
}

// Hero titles use a PNG logo in English or language-neutral; SVGs are skipped
// because TMDB serves them inconsistently and they cannot be sized by `srcset`.
export function selectLogoPath(logos: TMDBLogo[] | undefined): string | null {
	if (!logos) return null;
	const usable = logos.filter(
		(logo) =>
			typeof logo.file_path === 'string' &&
			logo.file_path.endsWith('.png') &&
			(logo.iso_639_1 === 'en' || logo.iso_639_1 === null)
	);
	usable.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
	return usable[0]?.file_path ?? null;
}
