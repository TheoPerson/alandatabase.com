import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('telemetry event stream quarantine', () => {
	it('returns a side-effect-free gone response', async () => {
		const response = (await GET({} as Parameters<typeof GET>[0])) as Response;

		expect(response.status).toBe(410);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
		expect(await response.json()).toEqual({
			error: 'Telemetry event streaming is disabled until owner-only redaction is implemented.'
		});
	});
});
