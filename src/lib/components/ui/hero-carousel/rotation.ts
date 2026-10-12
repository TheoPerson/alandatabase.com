export function nextIndex(index: number, count: number): number {
	return count <= 1 ? 0 : (index + 1) % count;
}

export function previousIndex(index: number, count: number): number {
	return count <= 1 ? 0 : (index - 1 + count) % count;
}

// Negative deltaX = finger moved left = show the next slide.
export function swipeDirection(deltaX: number, threshold = 40): 1 | -1 | 0 {
	if (deltaX <= -threshold) return 1;
	if (deltaX >= threshold) return -1;
	return 0;
}
