export const ALAN_SCORE_DIMENSIONS = [
	{ key: 'realism', label: 'Realism', weight: 20 },
	{ key: 'cinematography', label: 'Cinematography', weight: 15 },
	{ key: 'originalLanguageExperience', label: 'Original-language experience', weight: 10 },
	{ key: 'tension', label: 'Tension', weight: 15 },
	{ key: 'cast', label: 'Cast', weight: 10 },
	{ key: 'atmosphere', label: 'Atmosphere', weight: 15 },
	{ key: 'rewatchability', label: 'Rewatchability', weight: 15 }
] as const;

export type AlanScoreDimension = (typeof ALAN_SCORE_DIMENSIONS)[number]['key'];
export type AlanScoreStatus = 'unrated' | 'partial' | 'complete';
export type AlanScoreValues = Record<AlanScoreDimension, number | null>;

export type AlanScoreResult = {
	score: number | null;
	coverage: number;
	status: AlanScoreStatus;
	missing: AlanScoreDimension[];
};

export const EMPTY_ALAN_SCORE_VALUES: AlanScoreValues = Object.fromEntries(
	ALAN_SCORE_DIMENSIONS.map(({ key }) => [key, null])
) as AlanScoreValues;

export function isAlanScoreValue(value: number): boolean {
	return Number.isFinite(value) && value >= 0 && value <= 10 && Number.isInteger(value * 2);
}

export function calculateAlanScore(values: AlanScoreValues): AlanScoreResult {
	let weightedTotal = 0;
	let includedWeight = 0;
	const missing: AlanScoreDimension[] = [];

	for (const dimension of ALAN_SCORE_DIMENSIONS) {
		const value = values[dimension.key];
		if (value === null) {
			missing.push(dimension.key);
			continue;
		}
		if (!isAlanScoreValue(value)) {
			throw new RangeError(`${dimension.label} must be between 0 and 10 in 0.5 steps.`);
		}

		weightedTotal += value * dimension.weight;
		includedWeight += dimension.weight;
	}

	if (includedWeight === 0) {
		return { score: null, coverage: 0, status: 'unrated', missing };
	}

	return {
		score: Math.round((weightedTotal / includedWeight) * 10) / 10,
		coverage: includedWeight,
		status: includedWeight === 100 ? 'complete' : 'partial',
		missing
	};
}

export function normalizeAlanScoreTags(tags: Iterable<string>): string[] {
	const normalized = new Set<string>();
	for (const tag of tags) {
		const value = tag.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
		if (!value) continue;
		if (value.length > 32) throw new RangeError('Tags must be 32 characters or fewer.');
		normalized.add(value);
		if (normalized.size > 10) throw new RangeError('Use no more than 10 tags.');
	}
	return [...normalized];
}
