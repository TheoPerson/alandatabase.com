import './env.js';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function searchKeyword(query) {
	const res = await fetch(`${TMDB_BASE_URL}/search/keyword?api_key=${process.env.TMDB_API_KEY}&query=${query}`);
	const data = await res.json();
	console.log(`Results for ${query}:`);
	console.log(data.results.slice(0, 5));
}

await searchKeyword('erotic');
await searchKeyword('sex');
await searchKeyword('sexuality');
