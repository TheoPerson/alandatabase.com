import { describe, it, expect } from 'vitest';
import { isSafeHttpUrl } from './utils';

describe('isSafeHttpUrl', () => {
	it('should accept absolute http and https URLs', () => {
		expect(isSafeHttpUrl('https://example.com/video.mp4')).toBe(true);
		expect(isSafeHttpUrl('http://example.com/embed?id=1')).toBe(true);
	});

	it('should reject script-capable and malformed URLs', () => {
		expect(isSafeHttpUrl('javascript:alert(document.cookie)')).toBe(false);
		expect(isSafeHttpUrl(' JavaScript:alert(1)')).toBe(false);
		expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
		expect(isSafeHttpUrl('/relative/path')).toBe(false);
		expect(isSafeHttpUrl('')).toBe(false);
		expect(isSafeHttpUrl(null)).toBe(false);
	});
});
