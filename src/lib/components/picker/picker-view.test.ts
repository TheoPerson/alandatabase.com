import { describe, expect, it } from 'vitest';
import {
	interactionOutcome,
	interactionToast,
	isAnotherShortcut,
	pickerRating,
	pickerSignals,
	swipeDecision
} from './picker-view';

describe('pickerRating', () => {
	it('shows IMDb only when the candidate carries an IMDb rating', () => {
		expect(
			pickerRating({
				imdbRating: 8.14,
				imdbVoteCount: 1_250_000,
				tmdbRating: 7.9,
				tmdbVoteCount: 900
			})
		).toEqual({ source: 'IMDb', value: '8.1', votes: '1.3M' });
	});

	it('falls back to the TMDB rating, labelled TMDB, when IMDb is missing', () => {
		expect(
			pickerRating({ imdbRating: null, imdbVoteCount: null, tmdbRating: 7.46, tmdbVoteCount: 2400 })
		).toEqual({ source: 'TMDB', value: '7.5', votes: '2.4K' });
		expect(
			pickerRating({ imdbRating: 0, imdbVoteCount: 0, tmdbRating: 6.2, tmdbVoteCount: 0 })
		).toEqual({ source: 'TMDB', value: '6.2', votes: null });
	});

	it('returns null when neither source has a rating', () => {
		expect(
			pickerRating({ imdbRating: null, imdbVoteCount: null, tmdbRating: 0, tmdbVoteCount: 0 })
		).toBeNull();
	});
});

describe('pickerSignals', () => {
	it('lists rounded quality and taste scores and skips an empty taste signal', () => {
		expect(
			pickerSignals({
				qualityScore: 87.6,
				tasteMatchScore: 64.2,
				finalScore: 80,
				imdbRating: null,
				tmdbRating: 7
			})
		).toEqual([
			{ label: 'Quality', value: '88' },
			{ label: 'Taste match', value: '64' }
		]);
		expect(
			pickerSignals({
				qualityScore: 70,
				tasteMatchScore: 0,
				finalScore: 60,
				imdbRating: null,
				tmdbRating: 7
			})
		).toEqual([{ label: 'Quality', value: '70' }]);
	});
});

describe('interactionOutcome', () => {
	const saved = { watched: false, watchlist: true, favorite: false, rating: null };

	it('accepts only a success that carries the saved interaction', () => {
		expect(
			interactionOutcome({
				type: 'success',
				status: 200,
				data: { success: true, interaction: saved }
			})
		).toEqual({ ok: true, interaction: saved });
		expect(interactionOutcome({ type: 'success', status: 200, data: { success: true } })).toEqual({
			ok: false,
			message: 'That could not be saved. Please try again.'
		});
	});

	it('maps failures to readable messages', () => {
		expect(
			interactionOutcome({ type: 'failure', status: 401, data: { error: 'Sign in to log films.' } })
		).toEqual({ ok: false, message: 'Sign in to save films.' });
		expect(
			interactionOutcome({
				type: 'failure',
				status: 403,
				data: { error: 'Personal film activity needs a signed-in account.' }
			})
		).toEqual({ ok: false, message: 'Personal film activity needs a signed-in account.' });
		expect(interactionOutcome({ type: 'failure', status: 404, data: { error: 'x' } })).toEqual({
			ok: false,
			message: 'This film is no longer in the catalogue.'
		});
		for (const result of [
			{ type: 'failure', status: 400, data: { error: 'Unknown interaction type.' } },
			{ type: 'failure', status: 500, data: { error: 'Failed to update interaction.' } },
			{ type: 'error', status: 500, error: new Error('boom') },
			{ type: 'redirect', status: 303, location: '/auth/login' }
		] as const) {
			expect(interactionOutcome(result)).toEqual({
				ok: false,
				message: 'That could not be saved. Please try again.'
			});
		}
	});
});

describe('interactionToast', () => {
	const base = { watched: false, watchlist: false, favorite: false, rating: null };
	it('describes the confirmed state, not the request', () => {
		expect(interactionToast('watchlist', 'Heat', { ...base, watchlist: true })).toBe(
			'Heat added to your watchlist'
		);
		expect(interactionToast('watchlist', 'Heat', base)).toBe('Heat removed from your watchlist');
		expect(interactionToast('favorite', 'Heat', { ...base, favorite: true })).toBe(
			'Heat added to favourites'
		);
		expect(interactionToast('watched', 'Heat', { ...base, watched: true })).toBe(
			'Heat marked as watched'
		);
		expect(interactionToast('watched', 'Heat', base)).toBe('Heat marked as not watched');
	});
});

describe('isAnotherShortcut', () => {
	const plain = { tagName: 'BODY', isContentEditable: false, closest: () => null };
	const key = (overrides: Record<string, unknown> = {}) => ({
		key: 'ArrowRight',
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		defaultPrevented: false,
		target: plain,
		...overrides
	});

	it('triggers on a bare ArrowRight outside form controls', () => {
		expect(isAnotherShortcut(key())).toBe(true);
		expect(
			isAnotherShortcut(
				key({ target: { tagName: 'BUTTON', isContentEditable: false, closest: () => null } })
			)
		).toBe(true);
	});

	it('ignores other keys, modifiers and handled events', () => {
		expect(isAnotherShortcut(key({ key: 'ArrowLeft' }))).toBe(false);
		expect(isAnotherShortcut(key({ key: ' ' }))).toBe(false);
		expect(isAnotherShortcut(key({ altKey: true }))).toBe(false);
		expect(isAnotherShortcut(key({ metaKey: true }))).toBe(false);
		expect(isAnotherShortcut(key({ shiftKey: true }))).toBe(false);
		expect(isAnotherShortcut(key({ defaultPrevented: true }))).toBe(false);
	});

	it('never fires from a form control, an editable region or an open dialog', () => {
		for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
			expect(
				isAnotherShortcut(
					key({ target: { tagName, isContentEditable: false, closest: () => null } })
				)
			).toBe(false);
		}
		expect(
			isAnotherShortcut(
				key({ target: { tagName: 'DIV', isContentEditable: true, closest: () => null } })
			)
		).toBe(false);
		expect(
			isAnotherShortcut(
				key({ target: { tagName: 'BUTTON', isContentEditable: false, closest: () => ({}) } })
			)
		).toBe(false);
		expect(isAnotherShortcut(key({ target: null }))).toBe(true);
	});
});

describe('swipeDecision', () => {
	it('treats a clear leftward drag as Another', () => {
		expect(swipeDecision(-90, 10)).toBe('another');
	});

	it('cancels short, rightward or mostly vertical drags', () => {
		expect(swipeDecision(-40, 0)).toBe('cancel');
		expect(swipeDecision(120, 0)).toBe('cancel');
		expect(swipeDecision(-90, 80)).toBe('cancel');
	});
});
