import { redirect } from '@sveltejs/kit';

export function load({ params }: { params: { id: string } }) {
	throw redirect(308, `/tv/${encodeURIComponent(params.id)}`);
}
