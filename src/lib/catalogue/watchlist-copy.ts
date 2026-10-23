// Copy for the watchlist action. The server toggles, so every word comes from the
// real saved state, never from a guess about what the click did.

export function watchlistLabel(saved: boolean): string {
	return saved ? 'In your watchlist' : 'Watchlist';
}

export function watchlistToast(title: string, result: { type: string; data?: unknown }): string {
	if (result.type !== 'success') return 'Watchlist could not be updated.';
	const saved = (result.data as { watchlist?: unknown } | undefined)?.watchlist === true;
	return saved ? `${title} added to your watchlist` : `${title} removed from your watchlist`;
}
