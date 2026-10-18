// Chapter names worth showing. Shared by the media server (which drops generated names) and the
// player UI (which never shows one, even from an older cached response). Pure.

const TIMECODE_TITLE = /^(?:\(?\d{1,3}\)?\s*[-.:]?\s*)?(?:\d{1,2}[:.]){1,3}\d{1,3}$/u;
const NUMBER_TITLE = /^\d+$/u;
const GENERIC_TITLE = /^(?:chapter|chapitre|kapitel|cap[ií]tulo|sc[eè]ne)\s*\d+$/iu;

/**
 * A chapter name worth showing, or null for the names authoring tools generate: timecodes
 * ("(05)00:08:49:278"), bare numbers and numbered generic names ("Chapter 1", "Chapitre 3").
 */
export function meaningfulChapterTitle(title: string | null | undefined): string | null {
	const value = title?.trim();
	if (!value) return null;
	if (TIMECODE_TITLE.test(value) || NUMBER_TITLE.test(value) || GENERIC_TITLE.test(value)) {
		return null;
	}
	return value;
}
