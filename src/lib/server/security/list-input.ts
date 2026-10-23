// Server-side bounds for personal list input. The database column is varchar(200), but the
// product limit is lower so a long name never breaks the list header.
export const MAX_LIST_NAME = 120;
export const MAX_LIST_DESCRIPTION = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID.test(value);
}

function hasControlCharacter(value: string, allowLineBreaks: boolean): boolean {
	for (const character of value) {
		const code = character.codePointAt(0) ?? 0;
		if (allowLineBreaks && (code === 10 || code === 13)) continue;
		if (code <= 31 || code === 127) return true;
	}
	return false;
}

export type ListInputResult =
	{ ok: true; value: { name: string; description: string | null } } | { ok: false; error: string };

export function parseListInput(name: unknown, description: unknown): ListInputResult {
	const cleanName = typeof name === 'string' ? name.trim() : '';
	const cleanDescription = typeof description === 'string' ? description.trim() : '';

	if (!cleanName) return { ok: false, error: 'List name is required.' };
	if (cleanName.length > MAX_LIST_NAME) {
		return { ok: false, error: `List name must be ${MAX_LIST_NAME} characters or fewer.` };
	}
	if (cleanDescription.length > MAX_LIST_DESCRIPTION) {
		return {
			ok: false,
			error: `Description must be ${MAX_LIST_DESCRIPTION} characters or fewer.`
		};
	}
	if (hasControlCharacter(cleanName, false) || hasControlCharacter(cleanDescription, true)) {
		return { ok: false, error: 'List text contains unsupported control characters.' };
	}

	return { ok: true, value: { name: cleanName, description: cleanDescription || null } };
}
