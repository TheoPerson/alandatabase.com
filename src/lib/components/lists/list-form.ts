// Pure helpers for the personal Lists pages. The limits mirror
// $lib/server/security/list-input.ts (a server module the browser cannot import);
// the unit test pins them to the server values.
import type { PosterItem } from '$lib/catalogue/items';

export const LIST_NAME_MAX = 120;
export const LIST_DESCRIPTION_MAX = 1000;
/** The Lists index loader sends at most this many films per list (thumbnails). */
export const LIST_PREVIEW_LIMIT = 4;

/**
 * The length the server will measure: the form posts line breaks as CRLF and the
 * server trims, so a multiline field counts each line break as two characters.
 */
export function submittedLength(value: string, multiline = false): number {
	const sent = multiline ? value.replace(/\r\n|\r|\n/g, '\r\n') : value;
	return sent.trim().length;
}

export interface FieldStatus {
	length: number;
	remaining: number;
	over: boolean;
	/** Short visible counter, e.g. "12/120". */
	counter: string;
	/** Sentence for the polite live region, e.g. "108 characters left". */
	announcement: string;
}

const characters = (count: number) => `${count} character${count === 1 ? '' : 's'}`;

export function fieldStatus(value: string, max: number, multiline = false): FieldStatus {
	const length = submittedLength(value, multiline);
	const remaining = max - length;
	const over = remaining < 0;
	return {
		length,
		remaining,
		over,
		counter: `${length}/${max}`,
		announcement: over
			? `${characters(-remaining)} over the limit`
			: `${characters(remaining)} left`
	};
}

export interface ListFormProblem {
	field: 'name' | 'description';
	message: string;
}

/** Client-side mirror of the server checks, with the server's wording. */
export function validateListForm(name: string, description: string): ListFormProblem | null {
	const nameLength = submittedLength(name);
	if (nameLength === 0) return { field: 'name', message: 'List name is required.' };
	if (nameLength > LIST_NAME_MAX) {
		return { field: 'name', message: `List name must be ${LIST_NAME_MAX} characters or fewer.` };
	}
	if (submittedLength(description, true) > LIST_DESCRIPTION_MAX) {
		return {
			field: 'description',
			message: `Description must be ${LIST_DESCRIPTION_MAX} characters or fewer.`
		};
	}
	return null;
}

export function filmCount(count: number): string {
	return `${count} film${count === 1 ? '' : 's'}`;
}

/** The index only receives the first films of each list, so a full preview is a floor. */
export function previewCountLabel(previewCount: number, limit = LIST_PREVIEW_LIMIT): string {
	if (previewCount === 0) return 'Empty';
	if (previewCount >= limit) return `${limit}+ films`;
	return filmCount(previewCount);
}

interface ListMovie {
	id: string;
	title: string;
	posterPath?: string | null;
	releaseDate?: string | null;
	voteAverage?: number | string | null;
}

export function toListPosterItem(movie: ListMovie): PosterItem {
	return {
		id: String(movie.id),
		href: `/movies/${movie.id}`,
		title: movie.title,
		posterPath: movie.posterPath ?? null,
		releaseDate: movie.releaseDate ?? null,
		rating: movie.voteAverage ?? null
	};
}
