// Presentation helpers for the picker: what the card may honestly claim and how
// input maps to actions. The recommendation logic itself lives in $lib/server/picker.
import { formatRating, formatVotes } from '$lib/format';
import type { PickerRecommendationResponse } from '$lib/picker/types';

export type InteractionType = 'watched' | 'watchlist' | 'favorite';

export interface InteractionState {
	watched: boolean;
	watchlist: boolean;
	favorite: boolean;
	rating: number | null;
}

export interface PickerRating {
	source: 'IMDb' | 'TMDB';
	value: string;
	votes: string | null;
}

type RatingFields = Pick<
	PickerRecommendationResponse['movie'],
	'imdbRating' | 'imdbVoteCount' | 'tmdbRating' | 'tmdbVoteCount'
>;

/** IMDb only when the candidate actually carries it; otherwise the TMDB score, labelled TMDB. */
export function pickerRating(movie: RatingFields): PickerRating | null {
	const imdb = formatRating(movie.imdbRating);
	if (imdb) return { source: 'IMDb', value: imdb, votes: formatVotes(movie.imdbVoteCount) };
	const tmdb = formatRating(movie.tmdbRating);
	if (tmdb) return { source: 'TMDB', value: tmdb, votes: formatVotes(movie.tmdbVoteCount) };
	return null;
}

/** The engine's 0–100 scores, rounded; a zero taste score means no taste data, so it is left out. */
export function pickerSignals(
	signals: PickerRecommendationResponse['signals']
): Array<{ label: string; value: string }> {
	const list = [{ label: 'Quality', value: String(Math.round(signals.qualityScore)) }];
	if (signals.tasteMatchScore > 0) {
		list.push({ label: 'Taste match', value: String(Math.round(signals.tasteMatchScore)) });
	}
	return list;
}

const SAVE_FAILED = 'That could not be saved. Please try again.';

type ActionResultLike =
	| { type: 'success'; status: number; data?: unknown }
	| { type: 'failure'; status: number; data?: unknown }
	| { type: 'redirect'; status: number; location: string }
	| { type: 'error'; status?: number; error: unknown };

/** Reads a /movies/<id>?/logInteraction result: only a server-confirmed state counts. */
export function interactionOutcome(
	result: ActionResultLike
): { ok: true; interaction: InteractionState } | { ok: false; message: string } {
	if (result.type === 'success') {
		const interaction = (result.data as { interaction?: InteractionState } | undefined)
			?.interaction;
		return interaction ? { ok: true, interaction } : { ok: false, message: SAVE_FAILED };
	}
	if (result.type === 'failure') {
		if (result.status === 401) return { ok: false, message: 'Sign in to save films.' };
		if (result.status === 404) {
			return { ok: false, message: 'This film is no longer in the catalogue.' };
		}
		const error = (result.data as { error?: unknown } | undefined)?.error;
		if (result.status === 403 && typeof error === 'string') return { ok: false, message: error };
	}
	return { ok: false, message: SAVE_FAILED };
}

export function interactionToast(
	type: InteractionType,
	title: string,
	saved: InteractionState
): string {
	if (type === 'watchlist') {
		return saved.watchlist
			? `${title} added to your watchlist`
			: `${title} removed from your watchlist`;
	}
	if (type === 'favorite') {
		return saved.favorite ? `${title} added to favourites` : `${title} removed from favourites`;
	}
	return saved.watched ? `${title} marked as watched` : `${title} marked as not watched`;
}

interface ShortcutTarget {
	tagName?: string;
	isContentEditable?: boolean;
	closest?: (selector: string) => unknown;
}

interface ShortcutEvent {
	key: string;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	defaultPrevented: boolean;
	target: EventTarget | ShortcutTarget | null;
}

const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const FORM_OR_DIALOG =
	'[role="dialog"], [role="textbox"], [role="slider"], [role="combobox"], [role="listbox"]';

/** ArrowRight asks for another film, unless focus is in a form control or a dialog. */
export function isAnotherShortcut(event: ShortcutEvent): boolean {
	if (event.key !== 'ArrowRight' || event.defaultPrevented) return false;
	if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
	const target = event.target as ShortcutTarget | null;
	if (!target) return true;
	if (target.tagName && FORM_TAGS.has(target.tagName)) return false;
	if (target.isContentEditable) return false;
	if (typeof target.closest === 'function' && target.closest(FORM_OR_DIALOG)) return false;
	return true;
}

export const SWIPE_THRESHOLD = 64;

/** A drag counts as Another when it is mostly horizontal, leftwards and long enough. */
export function swipeDecision(
	dx: number,
	dy: number,
	threshold = SWIPE_THRESHOLD
): 'another' | 'cancel' {
	if (dx > -threshold) return 'cancel';
	if (Math.abs(dy) * 1.5 > Math.abs(dx)) return 'cancel';
	return 'another';
}
