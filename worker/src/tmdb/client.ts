import 'dotenv/config';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export interface TMDBGenre {
	id: number;
	name: string;
}

export interface TMDBMovieSummary {
	id: number;
	title: string;
	original_title: string;
	original_language: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	release_date: string;
	genre_ids: number[];
	popularity: number;
	vote_average: number;
	vote_count: number;
	adult: boolean;
}

export interface TMDBMovieDetail extends TMDBMovieSummary {
	tagline: string | null;
	runtime: number | null;
	status: string;
	budget: number;
	revenue: number;
	imdb_id: string | null;
	belongs_to_collection: {
		id: number;
		name: string;
		poster_path: string | null;
		backdrop_path: string | null;
	} | null;
	genres: TMDBGenre[];
	production_companies: Array<{
		id: number;
		name: string;
		logo_path: string | null;
		origin_country: string;
	}>;
	credits?: {
		cast: Array<{
			id: number;
			name: string;
			character: string;
			order: number;
			credit_id: string;
			profile_path: string | null;
			known_for_department: string;
		}>;
		crew: Array<{
			id: number;
			name: string;
			department: string;
			job: string;
			credit_id: string;
			profile_path: string | null;
			known_for_department: string;
		}>;
	};
	keywords?: {
		keywords: Array<{ id: number; name: string }>;
	};
	videos?: {
		results: Array<{
			key: string;
			site: string;
			type: string;
			name: string;
			official: boolean;
			published_at: string;
		}>;
	};
}

export class TMDBClient {
	private apiKey: string;
	private readToken: string;

	constructor() {
		this.apiKey = process.env.TMDB_API_KEY || '';
		this.readToken = process.env.TMDB_READ_TOKEN || '';
	}

	private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
		const url = new URL(`${TMDB_BASE_URL}${endpoint}`);

		if (this.apiKey) {
			url.searchParams.set('api_key', this.apiKey);
		}

		Object.entries(params).forEach(([key, val]) => url.searchParams.set(key, val));

		const headers: Record<string, string> = {
			Accept: 'application/json'
		};

		if (this.readToken) {
			headers['Authorization'] = `Bearer ${this.readToken}`;
		}

		const res = await fetch(url.toString(), { headers });

		if (!res.ok) {
			throw new Error(`TMDB API Error (${res.status}): ${res.statusText} at ${endpoint}`);
		}

		return (await res.json()) as T;
	}

	async getGenres(): Promise<TMDBGenre[]> {
		const data = await this.request<{ genres: TMDBGenre[] }>('/genre/movie/list');
		return data.genres;
	}

	async getPopularMovies(page = 1): Promise<{ results: TMDBMovieSummary[]; total_pages: number }> {
		return this.request<{ results: TMDBMovieSummary[]; total_pages: number }>('/movie/popular', {
			page: page.toString()
		});
	}

	async getTopRatedMovies(page = 1): Promise<{ results: TMDBMovieSummary[]; total_pages: number }> {
		return this.request<{ results: TMDBMovieSummary[]; total_pages: number }>('/movie/top_rated', {
			page: page.toString()
		});
	}

	async getMovieDetails(tmdbId: number): Promise<TMDBMovieDetail> {
		return this.request<TMDBMovieDetail>(`/movie/${tmdbId}`, {
			append_to_response: 'credits,keywords,videos'
		});
	}

	async getPersonDetails(tmdbId: number) {
		return this.request<{
			id: number;
			imdb_id: string | null;
			name: string;
			also_known_as: string[];
			biography: string;
			birthday: string | null;
			deathday: string | null;
			place_of_birth: string | null;
			profile_path: string | null;
			popularity: number;
			gender: number;
			known_for_department: string;
		}>(`/person/${tmdbId}`);
	}

	async searchMovies(
		query: string,
		page = 1
	): Promise<{ results: TMDBMovieSummary[]; total_pages: number }> {
		return this.request<{ results: TMDBMovieSummary[]; total_pages: number }>('/search/movie', {
			query,
			page: page.toString()
		});
	}
}
