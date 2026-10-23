import { json } from '@sveltejs/kit';

export function GET() {
	return json({
		name: 'Alan Database API',
		version: 'v3',
		status: 'ok',
		endpoints: {
			health: '/api/health',
			search: '/api/search?q=<query>',
			catalog: '/api/movies/catalog'
		}
	});
}
