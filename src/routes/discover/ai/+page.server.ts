import { redirect } from '@sveltejs/kit';

const geminiApiKey = process.env.GEMINI_API_KEY;

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	if (!geminiApiKey || geminiApiKey === 'YOUR_GEMINI_KEY') {
		return { missingApiKey: true };
	}

	return { missingApiKey: false };
}
