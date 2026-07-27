export const EXPERIMENTS = {
	CTA_BUTTON_COLOR: {
		id: 'cta_button_color',
		variants: ['control', 'test_gold', 'test_green'],
		weights: [0.5, 0.25, 0.25] // Control gets 50%, variants get 25% each
	},
	MOVIE_CARD_LAYOUT: {
		id: 'movie_card_layout',
		variants: ['standard', 'compact'],
		weights: [0.5, 0.5]
	}
};

/**
 * Assigns a variant based on a stable random hash of the user's session/device ID
 * so they consistently get the same experience.
 */
export function getVariant(experimentId: string, deviceId: string): string {
	const experiment = Object.values(EXPERIMENTS).find((e) => e.id === experimentId);
	if (!experiment) return 'control';

	// Simple hash function for consistent bucketing
	let hash = 0;
	const str = `${experimentId}:${deviceId}`;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0;
	}
	
	// Normalize hash to 0-1 range
	const normalized = Math.abs(hash) / 2147483648; 

	// Distribute based on weights
	let cumulative = 0;
	for (let i = 0; i < experiment.variants.length; i++) {
		cumulative += experiment.weights[i];
		if (normalized <= cumulative) {
			return experiment.variants[i];
		}
	}

	return experiment.variants[0];
}

/**
 * Runs all active experiments and returns the assigned variants
 */
export function assignAllExperiments(deviceId: string): Record<string, string> {
	const results: Record<string, string> = {};
	for (const exp of Object.values(EXPERIMENTS)) {
		results[exp.id] = getVariant(exp.id, deviceId);
	}
	return results;
}
