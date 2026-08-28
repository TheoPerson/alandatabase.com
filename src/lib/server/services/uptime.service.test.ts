import { describe, expect, it } from 'vitest';
import { normalizeUptimeRobotState } from './uptime.service';

describe('UptimeRobot status normalization', () => {
	it.each([
		['UP', 'operational'],
		['operational', 'operational'],
		[2, 'operational'],
		['seems_down', 'degraded'],
		[8, 'degraded'],
		['DOWN', 'outage'],
		[9, 'outage'],
		['paused', 'unknown'],
		[null, 'unknown']
	] as const)('maps %s to %s', (input, expected) => {
		expect(normalizeUptimeRobotState(input)).toBe(expected);
	});

	it('accepts object-shaped provider enums without leaking their payload', () => {
		expect(normalizeUptimeRobotState({ value: 'UP' })).toBe('operational');
		expect(normalizeUptimeRobotState({ name: 'DOWN' })).toBe('outage');
	});
});
