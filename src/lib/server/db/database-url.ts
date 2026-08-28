type DatabaseEnvironment = Record<string, string | undefined>;

function value(environment: DatabaseEnvironment, name: string): string | null {
	return environment[name]?.trim() || null;
}

export function resolveDatabaseUrl(environment: DatabaseEnvironment, building: boolean): string {
	if (environment.VERCEL_ENV === 'preview') {
		const previewConnectionString = value(environment, 'PREVIEW_DATABASE_URL');
		if (previewConnectionString) return previewConnectionString;
		if (building) return 'postgres://build:build@127.0.0.1:1/build';

		throw new Error('PREVIEW_DATABASE_URL is required in Vercel Preview.');
	}

	const connectionString = value(environment, 'POSTGRES_URL') ?? value(environment, 'DATABASE_URL');

	if (connectionString) return connectionString;
	if (building) return 'postgres://build:build@127.0.0.1:1/build';

	throw new Error('DATABASE_URL or POSTGRES_URL is not set.');
}
