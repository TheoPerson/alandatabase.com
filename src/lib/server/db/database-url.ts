type DatabaseEnvironment = Record<string, string | undefined>;

function value(environment: DatabaseEnvironment, name: string): string | null {
	return environment[name]?.trim() || null;
}

// Netlify exposes its deploy context only while building (CONTEXT), not to functions at
// runtime, so the build bakes it in and passes it here. Vercel exposes VERCEL_ENV at runtime.
// An empty context means a local or CI build. Any Netlify context other than production
// (deploy-preview, branch-deploy, and `dev`, the default for CLI draft deploys) is a preview
// and must never inherit the production database.
function isPreviewContext(deployContext: string): boolean {
	return deployContext !== '' && deployContext !== 'production';
}

export function resolveDatabaseUrl(
	environment: DatabaseEnvironment,
	building: boolean,
	deployContext = ''
): string {
	if (environment.VERCEL_ENV === 'preview' || isPreviewContext(deployContext)) {
		const previewConnectionString = value(environment, 'PREVIEW_DATABASE_URL');
		if (previewConnectionString) return previewConnectionString;
		if (building) return 'postgres://build:build@127.0.0.1:1/build';

		throw new Error('PREVIEW_DATABASE_URL is required in a preview deployment.');
	}

	const connectionString = value(environment, 'POSTGRES_URL') ?? value(environment, 'DATABASE_URL');

	if (connectionString) return connectionString;
	if (building) return 'postgres://build:build@127.0.0.1:1/build';

	throw new Error('DATABASE_URL or POSTGRES_URL is not set.');
}
