import { afterEach, describe, expect, it, vi } from 'vitest';
import { logServerError, safeDiagnostic } from './logging';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('server logging safety', () => {
	it('redacts URLs, bearer credentials and secret assignments', () => {
		const diagnostic = safeDiagnostic(
			new Error('postgres://user:pass@db.example/app Bearer abc.def token=secret-value <unsafe>')
		);

		expect(diagnostic).toContain('[redacted-url]');
		expect(diagnostic).toContain('Bearer [redacted]');
		expect(diagnostic).toContain('token=[redacted]');
		expect(diagnostic).not.toContain('user:pass');
		expect(diagnostic).not.toContain('abc.def');
		expect(diagnostic).not.toContain('secret-value');
		expect(diagnostic).not.toContain('<unsafe>');
	});

	it('logs only the bounded, sanitized diagnostic', () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		logServerError('Authentication failed', new Error(`password=hidden ${'x'.repeat(500)}`));

		expect(consoleError).toHaveBeenCalledTimes(1);
		const output = String(consoleError.mock.calls[0][0]);
		expect(output).toContain('Authentication failed: password=[redacted]');
		expect(output).not.toContain('hidden');
		expect(output.length).toBeLessThanOrEqual(373);
	});
});
