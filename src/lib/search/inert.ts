// While the palette is open the page behind it must not be reachable by keyboard,
// pointer or screen reader. bits-ui traps focus but does not mark the rest inert.

interface InertCandidate {
	inert: boolean;
	contains(node: unknown): boolean;
}

/**
 * Marks every child of `container` inert except those that contain a node in `keep`.
 * Returns a function that undoes exactly that (and only that), safe to call twice.
 */
export function inertOutside(
	container: { children: ArrayLike<object> },
	keep: ReadonlyArray<unknown>
): () => void {
	const changed: InertCandidate[] = [];
	const anchors = keep.filter((node) => node !== null && node !== undefined);

	for (const child of Array.from(container.children) as InertCandidate[]) {
		if (child.inert || anchors.some((node) => child.contains(node))) continue;
		child.inert = true;
		changed.push(child);
	}

	return () => {
		for (const child of changed.splice(0)) child.inert = false;
	};
}
