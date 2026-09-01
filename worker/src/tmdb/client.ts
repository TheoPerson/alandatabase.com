import 'dotenv/config';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

type FetchLike = typeof fetch;
type JsonRecord = Record<string, unknown>;

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
	keywords?: { keywords: Array<{ id: number; name: string }> };
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

export type TMDBReleaseDatesResponse = {
	id: number;
	results: Array<{
		iso_3166_1: string;
		release_dates: Array<{
			certification: string;
			descriptors: string[];
			iso_639_1: string | null;
			note: string;
			release_date: string;
			type: number;
		}>;
	}>;
};

export type TMDBWatchProvider = {
	display_priority: number;
	logo_path: string | null;
	provider_id: number;
	provider_name: string;
};

export type TMDBWatchProvidersResponse = {
	id: number;
	results: Record<
		string,
		{
			link: string;
			flatrate?: TMDBWatchProvider[];
			free?: TMDBWatchProvider[];
			ads?: TMDBWatchProvider[];
			rent?: TMDBWatchProvider[];
			buy?: TMDBWatchProvider[];
		}
	>;
};

export class TMDBRequestError extends Error {
	constructor(
		message: string,
		public readonly status: number | null,
		public readonly retryable: boolean
	) {
		super(message);
		this.name = 'TMDBRequestError';
	}
}

export type TMDBClientOptions = {
	readToken?: string;
	apiKey?: string;
	fetch?: FetchLike;
	timeoutMs?: number;
	maxRetries?: number;
	baseUrl?: string;
	delay?: (milliseconds: number) => Promise<void>;
};

function asRecord(value: unknown, context: string): JsonRecord {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new TypeError(`TMDB returned an invalid ${context}.`);
	}
	return value as JsonRecord;
}

function asArray(value: unknown, context: string): unknown[] {
	if (!Array.isArray(value)) throw new TypeError(`TMDB returned an invalid ${context}.`);
	return value;
}

function asString(value: unknown, context: string): string {
	if (typeof value !== 'string') throw new TypeError(`TMDB returned an invalid ${context}.`);
	return value;
}

function asNumber(value: unknown, context: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new TypeError(`TMDB returned an invalid ${context}.`);
	}
	return value;
}

function asBoolean(value: unknown, context: string): boolean {
	if (typeof value !== 'boolean') throw new TypeError(`TMDB returned an invalid ${context}.`);
	return value;
}

function asNullableString(value: unknown, context: string): string | null {
	return value === null ? null : asString(value, context);
}

function parseGenre(value: unknown): TMDBGenre {
	const genre = asRecord(value, 'genre');
	return { id: asNumber(genre.id, 'genre id'), name: asString(genre.name, 'genre name') };
}

function parseMovieSummary(value: unknown): TMDBMovieSummary {
	const movie = asRecord(value, 'movie summary');
	return {
		id: asNumber(movie.id, 'movie id'),
		title: asString(movie.title, 'movie title'),
		original_title: asString(movie.original_title, 'original title'),
		original_language: asString(movie.original_language, 'original language'),
		overview: asString(movie.overview, 'overview'),
		poster_path: asNullableString(movie.poster_path, 'poster path'),
		backdrop_path: asNullableString(movie.backdrop_path, 'backdrop path'),
		release_date: asString(movie.release_date, 'release date'),
		genre_ids: asArray(movie.genre_ids, 'genre ids').map((id) => asNumber(id, 'genre id')),
		popularity: asNumber(movie.popularity, 'popularity'),
		vote_average: asNumber(movie.vote_average, 'vote average'),
		vote_count: asNumber(movie.vote_count, 'vote count'),
		adult: asBoolean(movie.adult, 'adult flag')
	};
}

function parsePage(value: unknown): { results: TMDBMovieSummary[]; total_pages: number } {
	const page = asRecord(value, 'movie page');
	return {
		results: asArray(page.results, 'movie results').map(parseMovieSummary),
		total_pages: asNumber(page.total_pages, 'total pages')
	};
}

function parseMovieDetail(value: unknown): TMDBMovieDetail {
	const movie = asRecord(value, 'movie detail');
	const genres = asArray(movie.genres, 'genres').map(parseGenre);
	const summary = parseMovieSummary({ ...movie, genre_ids: genres.map((genre) => genre.id) });
	const keywords = movie.keywords === undefined ? undefined : asRecord(movie.keywords, 'keywords');

	// Calendar ingestion needs a validated classification envelope before it writes.
	if (keywords) {
		for (const value of asArray(keywords.keywords, 'keyword list')) {
			const keyword = asRecord(value, 'keyword');
			asNumber(keyword.id, 'keyword id');
			asString(keyword.name, 'keyword name');
		}
	}
	for (const value of asArray(movie.production_companies, 'production companies')) {
		const company = asRecord(value, 'production company');
		asNumber(company.id, 'company id');
		asString(company.name, 'company name');
	}

	return {
		...(movie as unknown as TMDBMovieDetail),
		...summary,
		genres,
		tagline: asNullableString(movie.tagline, 'tagline'),
		runtime: movie.runtime === null ? null : asNumber(movie.runtime, 'runtime'),
		status: asString(movie.status, 'status'),
		budget: asNumber(movie.budget, 'budget'),
		revenue: asNumber(movie.revenue, 'revenue'),
		imdb_id: asNullableString(movie.imdb_id, 'IMDb id')
	};
}

function parseReleaseDates(value: unknown): TMDBReleaseDatesResponse {
	const response = asRecord(value, 'release dates response');
	return {
		id: asNumber(response.id, 'release movie id'),
		results: asArray(response.results, 'release regions').map((value) => {
			const region = asRecord(value, 'release region');
			return {
				iso_3166_1: asString(region.iso_3166_1, 'release country'),
				release_dates: asArray(region.release_dates, 'release dates').map((value) => {
					const release = asRecord(value, 'release date');
					return {
						certification: asString(release.certification, 'certification'),
						descriptors:
							release.descriptors === undefined
								? []
								: asArray(release.descriptors, 'release descriptors').map((item) =>
										asString(item, 'release descriptor')
									),
						iso_639_1:
							release.iso_639_1 === undefined || release.iso_639_1 === null
								? null
								: asString(release.iso_639_1, 'release language'),
						note: asString(release.note, 'release note'),
						release_date: asString(release.release_date, 'regional release date'),
						type: asNumber(release.type, 'release type')
					};
				})
			};
		})
	};
}

function parseProvider(value: unknown): TMDBWatchProvider {
	const provider = asRecord(value, 'watch provider');
	return {
		display_priority: asNumber(provider.display_priority, 'provider priority'),
		logo_path: asNullableString(provider.logo_path, 'provider logo'),
		provider_id: asNumber(provider.provider_id, 'provider id'),
		provider_name: asString(provider.provider_name, 'provider name')
	};
}

function parseProviderList(value: unknown, context: string): TMDBWatchProvider[] | undefined {
	return value === undefined ? undefined : asArray(value, context).map(parseProvider);
}

function parseWatchProviders(value: unknown): TMDBWatchProvidersResponse {
	const response = asRecord(value, 'watch providers response');
	const regions = asRecord(response.results, 'watch provider regions');
	return {
		id: asNumber(response.id, 'provider movie id'),
		results: Object.fromEntries(
			Object.entries(regions).map(([country, value]) => {
				const region = asRecord(value, 'watch provider region');
				return [
					country,
					{
						link: asString(region.link, 'provider link'),
						flatrate: parseProviderList(region.flatrate, 'flatrate providers'),
						free: parseProviderList(region.free, 'free providers'),
						ads: parseProviderList(region.ads, 'ad providers'),
						rent: parseProviderList(region.rent, 'rental providers'),
						buy: parseProviderList(region.buy, 'purchase providers')
					}
				];
			})
		)
	};
}

export class TMDBClient {
	private readonly apiKey: string;
	private readonly readToken: string;
	private readonly fetcher: FetchLike;
	private readonly timeoutMs: number;
	private readonly maxRetries: number;
	private readonly baseUrl: string;
	private readonly delay: (milliseconds: number) => Promise<void>;

	constructor(options: TMDBClientOptions = {}) {
		this.apiKey = options.apiKey ?? process.env.TMDB_API_KEY ?? '';
		this.readToken = options.readToken ?? process.env.TMDB_READ_TOKEN ?? '';
		this.fetcher = options.fetch ?? fetch;
		this.timeoutMs = options.timeoutMs ?? 8_000;
		this.maxRetries = options.maxRetries ?? 2;
		this.baseUrl = options.baseUrl ?? TMDB_BASE_URL;
		this.delay =
			options.delay ??
			((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
	}

	private async request(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
		if (!this.readToken && !this.apiKey) {
			throw new TMDBRequestError('TMDB_READ_TOKEN is required.', null, false);
		}

		const url = new URL(`${this.baseUrl}${endpoint}`);
		if (this.apiKey) url.searchParams.set('api_key', this.apiKey);
		for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (this.readToken) headers.Authorization = `Bearer ${this.readToken}`;

		for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), this.timeoutMs);
			try {
				const response = await this.fetcher(url, { headers, signal: controller.signal });
				if (!response.ok) {
					const retryable = TRANSIENT_STATUSES.has(response.status);
					if (retryable && attempt < this.maxRetries) {
						const retryAfterHeader = response.headers.get('retry-after');
						const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
						await this.delay(
							Number.isFinite(retryAfter) ? Math.min(retryAfter * 1_000, 2_000) : 250 * 2 ** attempt
						);
						continue;
					}
					throw new TMDBRequestError(
						`TMDB request failed with status ${response.status} at ${endpoint}.`,
						response.status,
						retryable
					);
				}
				return await response.json();
			} catch (error) {
				if (error instanceof TMDBRequestError) throw error;
				if (attempt < this.maxRetries) {
					await this.delay(250 * 2 ** attempt);
					continue;
				}
				throw new TMDBRequestError(
					controller.signal.aborted
						? `TMDB request timed out at ${endpoint}.`
						: `TMDB request failed at ${endpoint}.`,
					null,
					true
				);
			} finally {
				clearTimeout(timer);
			}
		}
		throw new TMDBRequestError(`TMDB request failed at ${endpoint}.`, null, true);
	}

	async getGenres(): Promise<TMDBGenre[]> {
		const response = asRecord(
			await this.request('/genre/movie/list', { language: 'en-US' }),
			'genres response'
		);
		return asArray(response.genres, 'genres').map(parseGenre);
	}

	async getPopularMovies(page = 1) {
		return parsePage(
			await this.request('/movie/popular', { page: String(page), language: 'en-US' })
		);
	}

	async getTopRatedMovies(page = 1) {
		return parsePage(
			await this.request('/movie/top_rated', { page: String(page), language: 'en-US' })
		);
	}

	async getMovieDetails(tmdbId: number): Promise<TMDBMovieDetail> {
		return parseMovieDetail(
			await this.request(`/movie/${tmdbId}`, {
				append_to_response: 'credits,keywords,videos',
				language: 'en-US'
			})
		);
	}

	async discoverUpcomingMovies(input: { page: number; startDate: string; endDate: string }) {
		return parsePage(
			await this.request('/discover/movie', {
				page: String(input.page),
				'primary_release_date.gte': input.startDate,
				'primary_release_date.lte': input.endDate,
				include_adult: 'false',
				include_video: 'false',
				language: 'en-US',
				sort_by: 'popularity.desc'
			})
		);
	}

	async getMovieReleaseDates(tmdbId: number): Promise<TMDBReleaseDatesResponse> {
		return parseReleaseDates(await this.request(`/movie/${tmdbId}/release_dates`));
	}

	async getMovieWatchProviders(tmdbId: number): Promise<TMDBWatchProvidersResponse> {
		return parseWatchProviders(await this.request(`/movie/${tmdbId}/watch/providers`));
	}

	async searchMovies(query: string, page = 1) {
		return parsePage(
			await this.request('/search/movie', { query, page: String(page), language: 'en-US' })
		);
	}

	async discoverMovies(params: Record<string, string>) {
		return parsePage(await this.request('/discover/movie', params));
	}

	async getPersonDetails(tmdbId: number): Promise<JsonRecord> {
		return asRecord(await this.request(`/person/${tmdbId}`), 'person detail');
	}

	async searchPeople(query: string, page = 1): Promise<JsonRecord> {
		return asRecord(
			await this.request('/search/person', { query, page: String(page) }),
			'people page'
		);
	}

	async getPersonMovieCredits(personId: number): Promise<JsonRecord> {
		return asRecord(await this.request(`/person/${personId}/movie_credits`), 'person credits');
	}

	async getTopRatedTV(page = 1): Promise<JsonRecord> {
		return asRecord(await this.request('/tv/top_rated', { page: String(page) }), 'TV page');
	}

	async getTVDetails(tmdbId: number): Promise<JsonRecord> {
		return asRecord(
			await this.request(`/tv/${tmdbId}`, { append_to_response: 'credits,videos,external_ids' }),
			'TV detail'
		);
	}

	async searchTV(query: string, page = 1): Promise<JsonRecord> {
		return asRecord(
			await this.request('/search/tv', { query, page: String(page) }),
			'TV search page'
		);
	}
}
