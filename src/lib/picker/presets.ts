import type { PickerFilters, PickerPreset } from '$lib/server/picker/types';

// Shared with the browser (MoviePicker), so it must not live under $lib/server
export const QUICK_PRESETS: Record<PickerPreset, Partial<PickerFilters>> = {
	TONIGHT: {
		era: '1990+',
		minYear: 1990,
		minRating: 7.0,
		mode: 'balanced'
	},
	CLASSIC: {
		era: 'classic',
		minYear: 1950,
		maxYear: 1989,
		minRating: 7.5,
		mode: 'safe'
	},
	CRIME: {
		genres: ['Crime', 'Mystery'],
		minYear: 1980,
		minRating: 7.2,
		mode: 'balanced'
	},
	THRILLER: {
		genres: ['Thriller', 'Mystery'],
		minYear: 1990,
		minRating: 7.2,
		mode: 'balanced'
	},
	HIDDEN_GEM: {
		minYear: 1985,
		minRating: 7.4,
		mode: 'discovery'
	},
	HIGHLY_RATED: {
		minRating: 8.0,
		mode: 'safe'
	},
	SHORT: {
		maxRuntime: 110,
		minRating: 7.0,
		mode: 'balanced'
	}
};
