import { describe, expect, it } from 'vitest';
import {
	ALAN_SCORE_DIMENSIONS,
	calculateAlanScore,
	EMPTY_ALAN_SCORE_VALUES,
	isAlanScoreValue,
	normalizeAlanScoreTags,
	type AlanScoreValues
} from './alan-score';

function values(overrides: Partial<AlanScoreValues> = {}): AlanScoreValues {
	return { ...EMPTY_ALAN_SCORE_VALUES, ...overrides };
}

describe('Alan Score calculation', () => {
	it('returns an unrated result when every dimension is missing', () => {
		expect(calculateAlanScore(values())).toEqual({
			score: null,
			coverage: 0,
			status: 'unrated',
			missing: ALAN_SCORE_DIMENSIONS.map(({ key }) => key)
		});
	});

	it('normalizes partial scores over included weights only', () => {
		expect(calculateAlanScore(values({ realism: 8, cinematography: 6 }))).toMatchObject({
			score: 7.1,
			coverage: 35,
			status: 'partial'
		});
	});

	it('calculates a complete weighted score and rounds to one decimal', () => {
		expect(
			calculateAlanScore(
				values({
					realism: 7.5,
					cinematography: 9,
					originalLanguageExperience: 8,
					tension: 8.5,
					cast: 7,
					atmosphere: 9.5,
					rewatchability: 6.5
				})
			)
		).toEqual({ score: 8, coverage: 100, status: 'complete', missing: [] });
	});

	it.each([-0.5, 0.1, 10.5, Number.NaN, Number.POSITIVE_INFINITY])(
		'rejects invalid value %s',
		(value) => {
			expect(isAlanScoreValue(value)).toBe(false);
			expect(() => calculateAlanScore(values({ realism: value }))).toThrow(RangeError);
		}
	);

	it('accepts both endpoints and half steps', () => {
		expect(isAlanScoreValue(0)).toBe(true);
		expect(isAlanScoreValue(6.5)).toBe(true);
		expect(isAlanScoreValue(10)).toBe(true);
	});
});

describe('Alan Score tags', () => {
	it('trims, folds case, collapses whitespace and removes duplicates', () => {
		expect(normalizeAlanScoreTags([' Slow Burn ', 'slow   burn', 'Atmospheric'])).toEqual([
			'slow burn',
			'atmospheric'
		]);
	});
});
