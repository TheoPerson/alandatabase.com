import { load } from './src/routes/movies/+page.server.ts';

async function main() {
	try {
		console.log('Loading /movies...');
		const res = await load();
		console.log('Movies loaded:', res.allMovies.length, 'genres:', res.genreList.length);
	} catch (e) {
		console.error('Failed:', e);
	}
}
main();
