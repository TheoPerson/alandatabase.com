import { redirect } from '@sveltejs/kit';

// Old address kept alive for existing links; /tv is the single canonical TV page.
export function load() {
	throw redirect(308, '/tv');
}
