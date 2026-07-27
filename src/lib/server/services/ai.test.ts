import { describe, it, expect } from 'vitest';
import { buildAiPrompt } from './ai.service';

describe('AI Service - Prompt Builder', () => {
	it('should correctly format the user context into the prompt', () => {
		const userPrompt = 'I want a scary movie';
		const context = {
			topTitles: 'Alien (5 stars), The Thing (4 stars)',
			favoriteTitles: 'The Shining',
			reviewTexts: 'Movie: Saw | Review: Too gory for me.'
		};

		const prompt = buildAiPrompt(userPrompt, context);

		expect(prompt).toContain('I want a scary movie');
		expect(prompt).toContain('Alien (5 stars), The Thing (4 stars)');
		expect(prompt).toContain('The Shining');
		expect(prompt).toContain('Movie: Saw | Review: Too gory for me.');
		expect(prompt).toContain('JSON object');
	});

	it('should handle empty contexts gracefully', () => {
		const prompt = buildAiPrompt('Comedy', {
			topTitles: '',
			favoriteTitles: '',
			reviewTexts: ''
		});

		expect(prompt).toContain('Top Rated Films: None');
		expect(prompt).toContain('Favorite Films: None');
		expect(prompt).toContain('Recent Reviews:\nNone');
	});
});
