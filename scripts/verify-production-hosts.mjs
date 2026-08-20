import assert from 'node:assert/strict';

const REQUEST_TIMEOUT_MS = 20_000;
const securityHeaders = [
	'strict-transport-security',
	'x-content-type-options',
	'x-frame-options',
	'referrer-policy',
	'permissions-policy'
];

async function request(name, url, options = {}) {
	const response = await fetch(url, {
		redirect: 'manual',
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		...options
	});
	const body = await response.text();
	console.log(`${name.padEnd(24)} ${response.status} ${url}`);
	return { response, body };
}

function assertSecurityHeaders(response, name) {
	for (const header of securityHeaders) {
		assert.ok(response.headers.get(header), `${name} is missing ${header}`);
	}
}

const apex = await request('apex', 'https://alandatabase.com/');
assert.equal(apex.response.status, 200);
assert.match(apex.body, /A quieter way/u);
assertSecurityHeaders(apex.response, 'apex');

const movies = await request('public movies', 'https://alandatabase.com/movies');
assert.equal(movies.response.status, 200);
assert.match(movies.body, /TOP 10 Today/u);

const www = await request('www canonical', 'https://www.alandatabase.com/movies?probe=1');
assert.equal(www.response.status, 308);
assert.equal(www.response.headers.get('location'), 'https://alandatabase.com/movies?probe=1');

const vercelAlias = await request('vercel canonical', 'https://alans-database.vercel.app/');
assert.equal(vercelAlias.response.status, 308);
assert.equal(vercelAlias.response.headers.get('location'), 'https://alandatabase.com/');

const status = await request('public status', 'https://status.alandatabase.com/');
assert.equal(status.response.status, 200);
assert.match(status.body, /Public System Status/u);
assert.match(status.body, /Live database probe/u);
assert.match(status.body, /ONLINE/u);
assert.doesNotMatch(
	status.body,
	/DATABASE_URL|TMDB_API_KEY|TMDB_READ_TOKEN|connection string|stack trace/iu
);
assertSecurityHeaders(status.response, 'status');

const api = await request('api metadata', 'https://api.alandatabase.com/');
assert.equal(api.response.status, 200);
assert.deepEqual(JSON.parse(api.body), {
	name: 'Alan Database API',
	version: 'v3',
	status: 'ok',
	endpoints: {
		health: '/api/health',
		search: '/api/search?q=<query>',
		catalog: '/api/movies/catalog'
	}
});
assertSecurityHeaders(api.response, 'api');

const health = await request('api health', 'https://api.alandatabase.com/health');
assert.equal(health.response.status, 200);
assert.deepEqual(JSON.parse(health.body), { status: 'ok', db: true });

const privateApi = await request(
	'api owner gate',
	'https://api.alandatabase.com/search?q=test'
);
assert.equal(privateApi.response.status, 401);
assert.deepEqual(JSON.parse(privateApi.body), { error: 'Unauthorized' });

const allowedCors = await request('api allowed CORS', 'https://api.alandatabase.com/', {
	headers: { Origin: 'https://alandatabase.com' }
});
assert.equal(allowedCors.response.headers.get('access-control-allow-origin'), 'https://alandatabase.com');
assert.equal(allowedCors.response.headers.get('access-control-allow-credentials'), 'true');

const rejectedCors = await request('api rejected CORS', 'https://api.alandatabase.com/', {
	headers: { Origin: 'https://example.invalid' }
});
assert.equal(rejectedCors.response.headers.get('access-control-allow-origin'), null);

const auth = await request('auth portal', 'https://auth.alandatabase.com/');
assert.equal(auth.response.status, 200);
assert.match(auth.body, /Sign In/u);
assertSecurityHeaders(auth.response, 'auth');

const authNonPortal = await request('auth containment', 'https://auth.alandatabase.com/movies');
assert.equal(authNonPortal.response.status, 308);
assert.equal(authNonPortal.response.headers.get('location'), 'https://alandatabase.com/movies');

const admin = await request('admin owner gate', 'https://alandatabase.com/admin');
assert.equal(admin.response.status, 302);
assert.equal(
	admin.response.headers.get('location'),
	'https://auth.alandatabase.com/auth/login?returnTo=%2Fadmin'
);

for (const hostname of [
	'alandatabase.com',
	'www.alandatabase.com',
	'status.alandatabase.com',
	'api.alandatabase.com',
	'auth.alandatabase.com'
]) {
	const httpsUpgrade = await request(`https ${hostname}`, `http://${hostname}/`);
	assert.equal(httpsUpgrade.response.status, 308);
	assert.match(httpsUpgrade.response.headers.get('location') ?? '', /^https:\/\//u);
}

console.log('Production hostname verification passed.');
