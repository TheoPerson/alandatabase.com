import { describe, expect, it } from 'vitest';
import { ALLOWED_FRAME_SOURCES, denyFrameSources } from './response-policy';

const EXPECTED = 'frame-src https://www.youtube-nocookie.com;';

describe('cinema response policy', () => {
	it('allows exactly the trailer embed origin', () => {
		expect([...ALLOWED_FRAME_SOURCES]).toEqual(['https://www.youtube-nocookie.com']);
	});

	it('adds the frame allowlist when no policy exists', () => {
		expect(denyFrameSources(null)).toBe(EXPECTED);
	});

	it('preserves unrelated directives', () => {
		expect(denyFrameSources("default-src 'self'; img-src https: data:")).toBe(
			`default-src 'self'; img-src https: data:; ${EXPECTED}`
		);
	});

	it('replaces a permissive frame-src directive case-insensitively', () => {
		expect(
			denyFrameSources(
				"default-src 'self'; FRAME-SRC https://unsafe.example https://another.example"
			)
		).toBe(`default-src 'self'; ${EXPECTED}`);
	});

	it('never widens the allowlist from an incoming policy', () => {
		expect(denyFrameSources('frame-src *')).toBe(EXPECTED);
		expect(denyFrameSources("frame-src 'self' https://www.youtube.com")).toBe(EXPECTED);
	});
});
