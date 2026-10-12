export interface ReleaseNoteSection {
	title: string;
	items: string[];
}

export interface ReleaseNote {
	version: string;
	date: string | null;
	sections: ReleaseNoteSection[];
}

/** Parse the repository changelog into safe plain-text release notes for the public status UI. */
export function parseReleaseNotes(markdown: string): ReleaseNote[] {
	const releases: ReleaseNote[] = [];
	let release: ReleaseNote | null = null;
	let section: ReleaseNoteSection | null = null;

	for (const sourceLine of markdown.split(/\r?\n/u)) {
		const line = sourceLine.trim();
		const releaseMatch = /^## \[([^\]]+)\](?: - (.+))?$/u.exec(line);
		if (releaseMatch) {
			release = {
				version: releaseMatch[1],
				date: releaseMatch[2] ?? null,
				sections: []
			};
			releases.push(release);
			section = null;
			continue;
		}

		const sectionMatch = /^### (.+)$/u.exec(line);
		if (sectionMatch && release) {
			section = { title: sectionMatch[1], items: [] };
			release.sections.push(section);
			continue;
		}

		const itemMatch = /^- (.+)$/u.exec(line);
		if (itemMatch && section) section.items.push(itemMatch[1]);
	}

	return releases
		.map((entry) => ({
			...entry,
			sections: entry.sections.filter((entrySection) => entrySection.items.length > 0)
		}))
		.filter((entry) => entry.sections.length > 0);
}
