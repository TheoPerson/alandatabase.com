<footer class="footer">
	<div class="container footer-content">
		<div class="footer-left">
			<a href="/" class="footer-brand">🎬 CINEMA<span class="accent">DB</span></a>
			<p class="footer-tagline">Open-source cinema operating system. Built for movie lovers.</p>
		</div>

		<div class="footer-meta">
			<p class="attribution">
				Powered by <a href="https://themoviedb.org" target="_blank" rel="noopener">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.
			</p>
			<p class="copyright">
				Open Source (MIT) • Free & Self-Hostable
			</p>
		</div>
	</div>
</footer>

<style>
	.footer {
		background: var(--bg-surface-1);
		border-top: 1px solid var(--border-subtle);
		padding: 3rem 0;
		margin-top: 5rem;
	}

	.footer-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		justify-content: space-between;
	}

	@media (min-width: 768px) {
		.footer-content {
			flex-direction: row;
			align-items: center;
		}
	}

	.footer-brand {
		font-weight: 800;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.accent {
		color: var(--accent-gold);
	}

	.footer-tagline {
		font-size: 0.85rem;
		color: var(--text-tertiary);
		margin-top: 0.25rem;
	}

	.footer-meta {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.attribution a {
		color: var(--text-secondary);
		text-decoration: underline;
	}

	.attribution a:hover {
		color: var(--accent-gold);
	}
</style>
