import { describe, expect, it } from 'vitest';
import { parseReleaseNotes } from './release-notes';

describe('release note parser', () => {
	it('keeps release categories and plain-text items in source order', () => {
		const releases = parseReleaseNotes(`# Changelog

## [Unreleased]

### Major Updates

- Public status centre.

### Technical Improvements

- Cached uptime checks.

## [3.0.0-alpha.1] - 2026-08-21

### Security

- Owner routes fail closed.
`);

		expect(releases).toEqual([
			{
				version: 'Unreleased',
				date: null,
				sections: [
					{ title: 'Major Updates', items: ['Public status centre.'] },
					{ title: 'Technical Improvements', items: ['Cached uptime checks.'] }
				]
			},
			{
				version: '3.0.0-alpha.1',
				date: '2026-08-21',
				sections: [{ title: 'Security', items: ['Owner routes fail closed.'] }]
			}
		]);
	});

	it('ignores prose and empty sections', () => {
		expect(
			parseReleaseNotes('## [Unreleased]\n\nIntro\n\n### Fixed\n\n## [Empty] - 2026-01-01')
		).toEqual([]);
	});
});
