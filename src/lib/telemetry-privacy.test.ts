import { describe, expect, it } from 'vitest';
import {
	SENTRY_DATA_COLLECTION,
	sanitizeTelemetryText,
	scrubTelemetryEvent
} from './telemetry-privacy';

describe('telemetry privacy', () => {
	it('disables request, identity, body, query and database data collection', () => {
		expect(SENTRY_DATA_COLLECTION).toMatchObject({
			userInfo: false,
			cookies: false,
			httpBodies: [],
			urlQueryParams: false,
			databaseQueryData: false,
			stackFrameVariables: false
		});
	});

	it('redacts credentials from telemetry text', () => {
		const output = sanitizeTelemetryText(
			'https://example.test/path?token=abc Bearer secret password=hunter2'
		);

		expect(output).not.toContain('example.test');
		expect(output).not.toContain('secret');
		expect(output).not.toContain('hunter2');
	});

	it('removes request payloads and sanitizes exception messages', () => {
		const event = scrubTelemetryEvent({
			message: 'authorization=private',
			exception: { values: [{ value: 'postgres://user:pass@db/app' }] },
			request: {
				data: { password: 'private' },
				cookies: 'session=private',
				headers: { authorization: 'private' },
				query_string: 'token=private'
			}
		});

		expect(event.message).toBe('authorization=[redacted]');
		expect(event.exception?.values?.[0].value).toBe('[redacted-url]');
		expect(event.request).toEqual({});
	});
});
