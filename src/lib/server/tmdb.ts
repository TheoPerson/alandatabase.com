export {
	TMDBClient,
	TMDBRequestError,
	type TMDBClientOptions,
	type TMDBMovieDetail,
	type TMDBMovieSummary,
	type TMDBReleaseDatesResponse,
	type TMDBWatchProvider,
	type TMDBWatchProvidersResponse
} from '../../../worker/src/tmdb/client.js';
export { ingestMovie } from '../../../worker/src/tmdb/ingest-movies.js';
export {
	evaluateTMDBIngestionSafety,
	type TMDBIngestionSafetyDecision
} from '../../../worker/src/tmdb/ingest-safety.js';
