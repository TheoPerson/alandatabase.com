<footer class="footer">
	<div class="container footer-content">
		<div class="footer-left">
			<a href="/" class="footer-brand">ALAN<span class="accent">DB</span></a>
			<p class="footer-tagline">A personal cinema: films, series and what to watch tonight.</p>
		</div>

		<nav class="footer-links" aria-label="Footer">
			<a href="/about">About</a>
			<a href="/status">Status</a>
			<a href="/kit">UI kit</a>
			<a href="https://github.com/TheoPerson/alandatabase.com" target="_blank" rel="noreferrer"
				>GitHub</a
			>
		</nav>

		<div class="footer-meta">
			<p class="attribution">
				Powered by <a href="https://themoviedb.org" target="_blank" rel="noopener">TMDB</a>. This
				product uses the TMDB API but is not endorsed or certified by TMDB.
			</p>
			<p class="copyright">Open Source (MIT) • Free & Self-Hostable</p>
		</div>
	</div>
</footer>

<style>
	.footer {
		background: var(--bg-surface-1);
		border-top: 1px solid var(--border-subtle);
		/* Calm on a phone: a short closing band, not a second page. */
		padding: var(--space-5) 0;
		margin-top: var(--space-7);
	}

	.footer-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		justify-content: space-between;
	}

	@media (min-width: 768px) {
		.footer {
			padding: var(--space-7) 0;
			margin-top: 5rem;
		}
		.footer-content {
			flex-direction: row;
			align-items: center;
			gap: var(--space-5);
		}
	}

	.footer-brand {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-target);
		font-weight: 800;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.accent {
		color: var(--brand-primary);
	}

	.footer-links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		/* The targets' padding, not the text, sits on the page edge. */
		margin-inline: calc(-1 * var(--space-2));
	}

	.footer-links a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--touch-target);
		min-height: var(--touch-target);
		padding-inline: var(--space-2);
		color: var(--content-secondary);
		font-weight: 600;
		font-size: var(--text-sm);
		transition: color var(--duration-base) var(--ease-out);
	}

	.footer-links a:hover {
		color: var(--brand-primary);
	}

	.footer-tagline {
		font-size: 0.85rem;
		color: var(--text-tertiary);
		margin-top: 0;
	}

	.footer-meta {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	/* A 44px hit area around the inline link without changing the line height. */
	.attribution a {
		display: inline-block;
		min-width: var(--touch-target);
		padding: 0.8rem 0.25rem;
		margin: -0.8rem -0.25rem;
		color: var(--text-secondary);
		text-align: center;
		text-decoration: underline;
	}

	.attribution a:hover {
		color: var(--accent-gold);
	}
</style>
