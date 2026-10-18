// Small DOM helpers for dialogs and radio groups (Svelte actions). Keyboard only, no layout reads
// on the hot path.

// HTML controls only (an SVG <use href> is not a tab stop); roving items at tabindex -1 are skipped.
const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]';

function visible(el: HTMLElement): boolean {
	return (
		el instanceof HTMLElement &&
		el.tabIndex >= 0 &&
		el.getClientRects().length > 0 &&
		getComputedStyle(el).visibility !== 'hidden'
	);
}

export function focusables(root: HTMLElement): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
}

/**
 * Keeps Tab inside `node` and focuses its preferred element when it opens. `false` parks the trap
 * (a pre-built dialog that is hidden); switching back to a selector or undefined opens it again.
 */
export function trapFocus(node: HTMLElement, initial?: string | false) {
	let current = initial;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let raf = 0;
	// Focus right after the opening frame is painted: no forced style or layout inside the tap.
	function focusFirst() {
		cancelAnimationFrame(raf);
		clearTimeout(timer);
		raf = requestAnimationFrame(() => {
			timer = setTimeout(() => {
				if (!node.isConnected || current === false) return;
				const first =
					(current ? node.querySelector<HTMLElement>(current) : null) ??
					node.querySelector<HTMLElement>('[aria-selected="true"], [aria-checked="true"]') ??
					focusables(node)[0] ??
					node;
				first.focus({ preventScroll: true });
			});
		});
	}
	if (current !== false) focusFirst();
	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab' || current === false) return;
		const items = focusables(node);
		if (items.length === 0) {
			event.preventDefault();
			return;
		}
		const index = items.indexOf(document.activeElement as HTMLElement);
		const last = items.length - 1;
		if (event.shiftKey && index <= 0) {
			event.preventDefault();
			items[last].focus();
		} else if (!event.shiftKey && (index === last || index === -1)) {
			event.preventDefault();
			items[0].focus();
		}
	}
	node.addEventListener('keydown', onkeydown);
	return {
		update: (next?: string | false) => {
			const opening = current === false && next !== false;
			current = next;
			if (opening) focusFirst();
		},
		destroy: () => {
			cancelAnimationFrame(raf);
			clearTimeout(timer);
			node.removeEventListener('keydown', onkeydown);
		}
	};
}

/**
 * Arrow keys move between the enabled [role=radio] / [role=tab] children and select them (WAI-ARIA
 * radio group and automatic tabs). The checked item is the only one in the tab order.
 */
export function rovingGroup(node: HTMLElement, selector = '[role="radio"]') {
	function onkeydown(event: KeyboardEvent) {
		const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
		if (!keys.includes(event.key)) return;
		const items = [...node.querySelectorAll<HTMLElement>(selector)].filter(
			(el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true'
		);
		const index = items.indexOf(document.activeElement as HTMLElement);
		if (index === -1 || items.length === 0) return;
		event.preventDefault();
		event.stopPropagation();
		let next: number;
		if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = items.length - 1;
		else if (event.key === 'ArrowDown' || event.key === 'ArrowRight')
			next = (index + 1) % items.length;
		else next = (index - 1 + items.length) % items.length;
		items[next].focus();
		items[next].click();
	}
	node.addEventListener('keydown', onkeydown);
	return { destroy: () => node.removeEventListener('keydown', onkeydown) };
}
