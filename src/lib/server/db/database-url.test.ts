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
		).toThrow('PREVIEW_DATABASE_URL is required in a preview deployment.');
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

	describe('Netlify deploy contexts', () => {
		// Netlify exposes CONTEXT only while building, so the build bakes it in and
		// passes it here; it is not readable from process.env at runtime.
		it.each(['deploy-preview', 'branch-deploy'])('uses the preview URL in a %s', (context) => {
			expect(
				resolveDatabaseUrl(
					{ PREVIEW_DATABASE_URL: 'postgres://preview', DATABASE_URL: 'postgres://production' },
					false,
					context
				)
			).toBe('postgres://preview');
		});

		it.each(['deploy-preview', 'branch-deploy'])(
			'never falls back to production credentials in a %s',
			(context) => {
				expect(() =>
					resolveDatabaseUrl({ DATABASE_URL: 'postgres://production' }, false, context)
				).toThrow('PREVIEW_DATABASE_URL is required in a preview deployment.');
			}
		);

		it('treats the CLI draft-deploy default context (dev) as a preview, not production', () => {
			// `netlify deploy` builds with context "dev" unless told otherwise.
			expect(() =>
				resolveDatabaseUrl({ DATABASE_URL: 'postgres://production' }, false, 'dev')
			).toThrow('PREVIEW_DATABASE_URL is required in a preview deployment.');
			expect(
				resolveDatabaseUrl(
					{ PREVIEW_DATABASE_URL: 'postgres://preview', DATABASE_URL: 'postgres://production' },
					false,
					'dev'
				)
			).toBe('postgres://preview');
		});

		it('uses production credentials in the production context', () => {
			expect(
				resolveDatabaseUrl(
					{ PREVIEW_DATABASE_URL: 'postgres://preview', DATABASE_URL: 'postgres://production' },
					false,
					'production'
				)
			).toBe('postgres://production');
		});

		it('still uses an inert URL while building a preview', () => {
			expect(resolveDatabaseUrl({}, true, 'deploy-preview')).toContain('127.0.0.1:1');
		});
	});
});
