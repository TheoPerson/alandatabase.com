import { describe, expect, it } from 'vitest';
import { resolveDatabaseUrl } from './database-url';

describe('database URL selection', () => {
	it('uses the preview URL only in a Vercel preview', () => {
		expect(
			resolveDatabaseUrl(
				{
					VERCEL_ENV: 'preview',
					PREVIEW_DATABASE_URL: ' postgres://preview ',
					POSTGRES_URL: 'postgres://production'
				},
				false
			)
		).toBe('postgres://preview');
	});

	it('ignores preview credentials outside previews', () => {
		expect(
			resolveDatabaseUrl(
				{
					VERCEL_ENV: 'production',
					PREVIEW_DATABASE_URL: 'postgres://preview',
					DATABASE_URL: 'postgres://production'
				},
				false
			)
		).toBe('postgres://production');
	});

	it('does not fall back to production credentials in a preview', () => {
		expect(() =>
			resolveDatabaseUrl(
				{
					VERCEL_ENV: 'preview',
					POSTGRES_URL: 'postgres://production',
					DATABASE_URL: 'postgres://production-fallback'
				},
				false
			)
		).toThrow('PREVIEW_DATABASE_URL is required in Vercel Preview.');
	});

	it('fails closed when only preview credentials exist outside previews', () => {
		expect(() => resolveDatabaseUrl({ PREVIEW_DATABASE_URL: 'postgres://preview' }, false)).toThrow(
			'DATABASE_URL or POSTGRES_URL is not set.'
		);
	});

	it('uses an inert URL only while building', () => {
		expect(resolveDatabaseUrl({}, true)).toContain('127.0.0.1:1');
		expect(resolveDatabaseUrl({ VERCEL_ENV: 'preview' }, true)).toContain('127.0.0.1:1');
	});
});
