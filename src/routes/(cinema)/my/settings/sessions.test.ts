import { describe, expect, it } from 'vitest';
import { formatSessionDate, groupSessions } from './sessions';

const session = (createdAt: string, isCurrent = false) => ({
	isCurrent,
	createdAt,
	expiresAt: '2026-12-01T00:00:00.000Z'
});

describe('groupSessions', () => {
	it('puts this device first, then the newest other sessions', () => {
		const grouped = groupSessions([
			session('2026-10-01T10:00:00.000Z'),
			session('2026-10-03T10:00:00.000Z'),
			session('2026-10-02T10:00:00.000Z', true)
		]);
		expect(grouped.current?.createdAt).toBe('2026-10-02T10:00:00.000Z');
		expect(grouped.visible.map((item) => item.createdAt)).toEqual([
			'2026-10-03T10:00:00.000Z',
			'2026-10-01T10:00:00.000Z'
		]);
		expect(grouped.hidden).toEqual([]);
		expect(grouped.otherCount).toBe(2);
	});

	it('shows three other sessions and folds the rest', () => {
		const others = Array.from({ length: 30 }, (_, index) =>
			session(`2026-09-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`)
		);
		const grouped = groupSessions([...others, session('2026-10-18T04:22:00.000Z', true)]);
		expect(grouped.visible).toHaveLength(3);
		expect(grouped.visible[0].createdAt).toBe('2026-09-30T08:00:00.000Z');
		expect(grouped.hidden).toHaveLength(27);
		expect(grouped.otherCount).toBe(30);
	});

	it('works without a current session', () => {
		const grouped = groupSessions([session('2026-10-01T10:00:00.000Z')]);
		expect(grouped.current).toBeNull();
		expect(grouped.visible).toHaveLength(1);
	});
});

describe('formatSessionDate', () => {
	it('renders the same text on the server and in the browser (fixed locale and zone)', () => {
		expect(formatSessionDate('2026-10-18T04:22:31.000Z')).toBe('18 Oct 2026, 04:22 UTC');
	});

	it('survives a bad date', () => {
		expect(formatSessionDate('not a date')).toBe('Unknown date');
	});
});
