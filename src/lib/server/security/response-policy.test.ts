import { describe, expect, it } from 'vitest';
import { denyFrameSources } from './response-policy';

describe('cinema response policy', () => {
	it('adds a frame deny rule when no policy exists', () => {
		expect(denyFrameSources(null)).toBe("frame-src 'none';");
	});

	it('preserves unrelated directives', () => {
		expect(denyFrameSources("default-src 'self'; img-src https: data:")).toBe(
			"default-src 'self'; img-src https: data:; frame-src 'none';"
		);
	});

	it('replaces a permissive frame-src directive case-insensitively', () => {
		expect(
			denyFrameSources(
				"default-src 'self'; FRAME-SRC https://unsafe.example https://another.example"
			)
		).toBe("default-src 'self'; frame-src 'none';");
	});
});
