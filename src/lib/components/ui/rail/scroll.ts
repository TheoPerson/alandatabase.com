export function railScrollTarget(
	scrollLeft: number,
	clientWidth: number,
	scrollWidth: number,
	direction: 1 | -1
): number {
	const maximum = Math.max(0, scrollWidth - clientWidth);
	const target = scrollLeft + direction * clientWidth * 0.9;
	return Math.min(maximum, Math.max(0, Math.round(target)));
}
