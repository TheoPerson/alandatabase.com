import { describe, expect, it } from 'vitest';
import { errorCopy } from './copy';

describe('errorCopy', () => {
	it('explains a missing page without blaming the visitor', () => {
		const copy = errorCopy(404, 'Not Found');
		expect(copy.title).toBe("We can't find that page");
		expect(copy.description).toMatch(/moved|removed|link/i);
		expect(copy.retryable).toBe(false);
	});

	it('explains restricted access for 401 and 403', () => {
		for (const status of [401, 403]) {
			expect(errorCopy(status, 'Forbidden').title).toBe('This area is private');
		}
	});

	it('marks server problems as retryable and shows a short, safe message', () => {
		const copy = errorCopy(503, 'The catalogue is temporarily unavailable.');
		expect(copy.title).toBe('Something went wrong on our side');
		expect(copy.description).toBe('The catalogue is temporarily unavailable.');
		expect(copy.retryable).toBe(true);
	});

	it('falls back to a generic sentence for an empty or very long message', () => {
		expect(errorCopy(500, '').description).toMatch(/try again/i);
		expect(errorCopy(500, 'x'.repeat(400)).description).toMatch(/try again/i);
	});

	it('treats a bad request as the visitor-fixable case', () => {
		const copy = errorCopy(400, 'Genre must be a whole number.');
		expect(copy.title).toBe("That request didn't look right");
		expect(copy.description).toBe('Genre must be a whole number.');
		expect(copy.retryable).toBe(false);
	});
});
