import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	throw error(410, 'AI recommendations are unavailable until privacy controls are complete.');
};
