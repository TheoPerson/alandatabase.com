import { describe, expect, it } from 'vitest';
import { watchlistLabel, watchlistToast } from './watchlist-copy';

describe('watchlist copy', () => {
	it('labels the action from the saved state', () => {
		expect(watchlistLabel(false)).toBe('Watchlist');
		expect(watchlistLabel(true)).toBe('In your watchlist');
	});

	it('words the toast from the server result, never from a guess', () => {
		expect(watchlistToast('Dune', { type: 'success', data: { watchlist: true } })).toBe(
			'Dune added to your watchlist'
		);
		expect(watchlistToast('Dune', { type: 'success', data: { watchlist: false } })).toBe(
			'Dune removed from your watchlist'
		);
		expect(watchlistToast('Dune', { type: 'failure' })).toBe('Watchlist could not be updated.');
		expect(watchlistToast('Dune', { type: 'error' })).toBe('Watchlist could not be updated.');
	});
});
