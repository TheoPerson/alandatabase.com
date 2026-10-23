import { describe, expect, it } from 'vitest';
import { jsonLdScript } from './json-ld';

function inner(markup: string): string {
	const match = /^<script type="application\/ld\+json">([\s\S]*)<\/script>$/u.exec(markup);
	if (!match) throw new Error(`unexpected markup: ${markup}`);
	return match[1];
}

describe('jsonLdScript', () => {
	it('keeps ampersands valid: the body parses back to the original value', () => {
		const value = { '@type': 'Movie', name: 'Minions & Monsters', description: 'A & B < C > D' };
		expect(JSON.parse(inner(jsonLdScript(value)))).toEqual(value);
	});

	it('never emits a raw <, > or & inside the script body', () => {
		const body = inner(jsonLdScript({ name: '</script><img src=x onerror=alert(1)> & more' }));
		expect(body).not.toMatch(/[<>&]/u);
	});

	it('cannot be closed early by hostile text', () => {
		const markup = jsonLdScript({ name: '</script><script>alert(1)</script>' });
		expect(markup.match(/<\/script>/gu)).toHaveLength(1);
		expect(markup.match(/<script/gu)).toHaveLength(1);
	});

	it('escapes the line separators that break older parsers', () => {
		const body = inner(jsonLdScript({ name: 'a\u2028b\u2029c' }));
		expect(body).not.toContain('\u2028');
		expect(body).not.toContain('\u2029');
		expect(JSON.parse(body).name).toBe('a\u2028b\u2029c');
	});
});
