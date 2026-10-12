import { describe, expect, it } from 'vitest';
import { POST } from './+server';

describe('playback telemetry quarantine', () => {
	it('returns a side-effect-free gone response', async () => {
		const response = (await POST({} as Parameters<typeof POST>[0])) as Response;

		expect(response.status).toBe(410);
		expect(await response.json()).toEqual({
			error: 'Playback telemetry is disabled until an approved source pipeline exists.'
		});
	});
});
