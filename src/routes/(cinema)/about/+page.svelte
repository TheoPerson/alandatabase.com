<svelte:head>
	<title>Data Sources and Credits | Alan Database</title>
	<meta
		name="description"
		content="Data-source credits and attribution for the Alan Database film and television archive."
	/>
</svelte:head>

<div class="credits-page container">
	<header>
		<p class="eyebrow">About</p>
		<h1>Data sources and credits</h1>
		<p>
			Alan Database combines reviewed local records with clearly attributed third-party metadata.
		</p>
	</header>

	<section aria-labelledby="tmdb-heading">
		<a href="https://www.themoviedb.org" target="_blank" rel="noopener" class="tmdb-logo">
			<img
				src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg"
				alt="The Movie Database (TMDB)"
				width="240"
				height="18"
			/>
		</a>
		<h2 id="tmdb-heading">The Movie Database</h2>
		<p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
		<p>
			Film metadata, artwork, release-date details, and regional provider snapshots may originate
			from TMDB. Local review and personal data remain separate.
		</p>
	</section>

	<section aria-labelledby="justwatch-heading">
		<h2 id="justwatch-heading">JustWatch</h2>
		<p>
			Regional provider availability is supplied by <strong>JustWatch</strong> through TMDB. Provider
			entries are current snapshots, not release dates, cinema showtimes, or guaranteed playback links.
		</p>
	</section>
</div>

<style>
	.credits-page {
		width: min(100%, 54rem);
		padding-block: clamp(2.5rem, 7vw, 6rem);
	}
	header {
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--border-subtle);
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.35rem 0 0.75rem;
		font-size: clamp(2rem, 5vw, 3.5rem);
		line-height: 1.05;
	}
	header p,
	section p {
		color: var(--content-secondary);
	}
	section {
		padding-block: 2rem;
		border-bottom: 1px solid var(--border-subtle);
	}
	section h2 {
		margin: 0.8rem 0 0.6rem;
		font-size: 1.35rem;
	}
	section p + p {
		margin-top: 0.65rem;
	}
	.tmdb-logo {
		display: inline-flex;
		max-width: min(15rem, 70vw);
	}
	.tmdb-logo img {
		width: 100%;
		height: auto;
	}
</style>
