import { describe, expect, it } from 'vitest';
import {
	formatDate,
	formatMoney,
	formatRating,
	formatRuntime,
	formatVotes,
	formatYear
} from './format';

describe('formatters', () => {
	it('formats runtime as hours and minutes', () => {
		expect(formatRuntime(110)).toBe('1h 50m');
		expect(formatRuntime(60)).toBe('1h');
		expect(formatRuntime(45)).toBe('45m');
		expect(formatRuntime(0)).toBeNull();
		expect(formatRuntime(null)).toBeNull();
		expect(formatRuntime('95')).toBe('1h 35m');
	});

	it('extracts a year from an ISO date and rejects garbage', () => {
		expect(formatYear('2001-05-05')).toBe('2001');
		expect(formatYear('2001')).toBe('2001');
		expect(formatYear('not a date')).toBeNull();
		expect(formatYear(null)).toBeNull();
	});

	it('formats ratings with one decimal and hides zero', () => {
		expect(formatRating(7.823)).toBe('7.8');
		expect(formatRating('8.00')).toBe('8.0');
		expect(formatRating(0)).toBeNull();
		expect(formatRating(null)).toBeNull();
	});

	it('compacts vote counts', () => {
		expect(formatVotes(950)).toBe('950');
		expect(formatVotes(12345)).toBe('12K');
		expect(formatVotes(2_300_000)).toBe('2.3M');
		expect(formatVotes(null)).toBeNull();
	});

	it('formats money in short dollars and hides zero', () => {
		expect(formatMoney(165_000_000)).toBe('$165M');
		expect(formatMoney(2_500_000_000)).toBe('$2.5B');
		expect(formatMoney(850_000)).toBe('$850K');
		expect(formatMoney(0)).toBeNull();
	});

	it('formats a long date in English', () => {
		expect(formatDate('2001-05-05')).toBe('5 May 2001');
		expect(formatDate('bad')).toBeNull();
	});
});
