import { describe, expect, it } from 'vitest';
import {
	SENTRY_DATA_COLLECTION,
	sanitizeTelemetryText,
	scrubBreadcrumb,
	scrubTelemetryEvent,
	tracesSampler
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

	it('redacts Windows drive and UNC paths (library files never leave the server)', () => {
		const output = sanitizeTelemetryText(
			'session 1: ffmpeg exited with 1 (F:\\MOVIES\\Alien.Resurrection.1997.mkv: Invalid data | C:/cache/x.vtt) and \\\\nas\\films\\Apex.mkv'
		);
		expect(output).not.toMatch(/MOVIES|Alien|cache|nas|films|Apex/u);
		expect(output).toContain('[redacted-path]');
		expect(output).toContain('Invalid data');
	});

	it('drops media console breadcrumbs and redacts paths in the others', () => {
		expect(
			scrubBreadcrumb({
				category: 'console',
				message: '[media] session a: ffmpeg exited with 1 (F:\\MOVIES\\a.mkv)',
				data: { arguments: ['[media] …', 'F:\\MOVIES\\a.mkv'] }
			})
		).toBeNull();
		const kept = scrubBreadcrumb({
			category: 'console',
			message: 'warn E:\\Lib\\b.mkv missing',
			data: { arguments: ['warn', 'E:\\Lib\\b.mkv'] }
		});
		expect(kept?.message).toBe('warn [redacted-path] missing');
		expect(kept?.data).toBeUndefined();
		const http = scrubBreadcrumb({ category: 'http', data: { url: '/api/media/progress' } });
		expect(http).toEqual({ category: 'http', data: { url: '/api/media/progress' } });
	});

	it('scrubs breadcrumbs already on an event', () => {
		const event = scrubTelemetryEvent({
			breadcrumbs: [
				{ category: 'console', message: '[media] unexpected error ENOENT F:\\MOVIES\\c.mkv' },
				{ category: 'console', message: 'open F:\\MOVIES\\d.mkv' }
			]
		});
		expect(event.breadcrumbs).toEqual([{ category: 'console', message: 'open [redacted-path]' }]);
	});

	it('never samples traces of the player or the media API', () => {
		const sample = (name: string) => tracesSampler({ name, inheritOrSampleWith: (rate) => rate });
		expect(sample('GET /api/media/sessions/[sid]/[name]')).toBe(0);
		expect(sample('GET /watch/[fileId]')).toBe(0);
		expect(sample('GET /(cinema)/watch/[fileId]')).toBe(0);
		expect(sample('GET /movies/[id]')).toBe(0.1);
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
