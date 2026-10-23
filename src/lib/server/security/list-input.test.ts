import { describe, expect, it } from 'vitest';
import { isUuid, MAX_LIST_DESCRIPTION, MAX_LIST_NAME, parseListInput } from './list-input';

describe('isUuid', () => {
	it('accepts canonical UUIDs only', () => {
		expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
		expect(isUuid('not-a-uuid')).toBe(false);
		expect(isUuid('')).toBe(false);
		expect(isUuid(undefined)).toBe(false);
		expect(isUuid("123e4567-e89b-12d3-a456-426614174000'; drop table")).toBe(false);
	});
});

describe('parseListInput', () => {
	it('trims and accepts a normal list', () => {
		expect(parseListInput('  Friday night  ', '  Cosy films ')).toEqual({
			ok: true,
			value: { name: 'Friday night', description: 'Cosy films' }
		});
	});

	it('stores an empty description as null', () => {
		expect(parseListInput('A', '   ')).toEqual({
			ok: true,
			value: { name: 'A', description: null }
		});
		expect(parseListInput('A', undefined)).toMatchObject({
			ok: true,
			value: { description: null }
		});
	});

	it('requires a name', () => {
		expect(parseListInput('', 'x')).toMatchObject({ ok: false });
		expect(parseListInput('   ', 'x')).toMatchObject({ ok: false });
		expect(parseListInput(undefined, 'x')).toMatchObject({ ok: false });
	});

	it('bounds the name and description', () => {
		expect(parseListInput('a'.repeat(MAX_LIST_NAME), '')).toMatchObject({ ok: true });
		expect(parseListInput('a'.repeat(MAX_LIST_NAME + 1), '')).toMatchObject({ ok: false });
		expect(parseListInput('A', 'b'.repeat(MAX_LIST_DESCRIPTION + 1))).toMatchObject({ ok: false });
	});

	it('rejects control characters but keeps line breaks in the description', () => {
		expect(parseListInput('bad\u0000name', '')).toMatchObject({ ok: false });
		expect(parseListInput('A', 'line one\nline two')).toMatchObject({
			ok: true,
			value: { description: 'line one\nline two' }
		});
		expect(parseListInput('A', 'bell\u0007')).toMatchObject({ ok: false });
	});
});
