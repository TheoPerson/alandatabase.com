<script lang="ts">
	import BackdropImage from '$lib/components/ui/backdrop-image';
	import Button from '$lib/components/ui/button';
	import MetaChips from '$lib/components/ui/meta-chips';
	import PosterCard from '$lib/components/ui/poster-card';
	import Rail from '$lib/components/ui/rail';
	import Section from '$lib/components/ui/section';
	import { addToast } from '$lib/stores/toast';
	import { tmdbImageUrl } from '$lib/tmdb/images';
	import ArrowLeftIcon from 'lucide-svelte/icons/arrow-left';
	import ShareIcon from 'lucide-svelte/icons/share-2';
	import ExternalLinkIcon from 'lucide-svelte/icons/external-link';

	let { data } = $props();
	const show = $derived(data.show);

	const meta = $derived([
		show.years,
		show.seasons ? `${show.seasons} season${show.seasons === 1 ? '' : 's'}` : null,
		`#${show.rank} on the IMDb Top TV chart`
	]);
	const canonicalUrl = $derived(`https://alandatabase.com/tv/${show.tmdbId}`);
	const socialImage = $derived(tmdbImageUrl(show.backdropPath, 'w1280'));
	const description = $derived(show.overview.slice(0, 155));

	async function share() {
		const url = window.location.href;
		try {
			if (navigator.share) {
				await navigator.share({ title: show.title, url });
				return;
			}
			await navigator.clipboard.writeText(url);
			addToast('Link copied', 'success');
		} catch (err) {
			// Closing the share sheet is not an error worth reporting.
			if ((err as Error)?.name !== 'AbortError') addToast('Could not share this series', 'error');
		}
	}
</script>

<svelte:head>
	<title>{show.title} ({show.firstYear}) | Alan's Database</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:title" content={`${show.title} | Alan's Database`} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="video.tv_show" />
	<meta property="og:url" content={canonicalUrl} />
	{#if socialImage}<meta property="og:image" content={socialImage} />{/if}
	<meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
</svelte:head>

<article class="detail">
	<header class="header">
		<BackdropImage path={show.backdropPath} eager animate={false} priority="low" sizes="100vw" />
		<div class="scrim" aria-hidden="true"></div>
		<div class="header-content">
			<div class="poster">
				<PosterCard
					id={`tv-${show.tmdbId}`}
					title={show.title}
					posterPath={show.posterPath}
					eager
					sizes="(min-width: 768px) 240px, 120px"
				/>
			</div>
			<div class="text">
				<p class="eyebrow">Series</p>
				<h1 class="title">{show.title}</h1>
				<div class="rating-line">
					<span class="score" aria-label={`IMDb rating ${show.rating} out of 10`}>
						<span class="score-value">{show.rating.toFixed(1)}</span>
						<span class="score-source">IMDb</span>
					</span>
					<MetaChips items={meta} />
				</div>
				{#if show.genres.length}
					<ul class="genres" aria-label="Genres">
						{#each show.genres as genre (genre)}
							<li>{genre}</li>
						{/each}
					</ul>
				{/if}
				<div class="actions">
					<Button variant="secondary" onclick={share}>
						<ShareIcon size={18} aria-hidden="true" />
						Share
					</Button>
					{#if show.imdbId}
						<Button
							variant="ghost"
							href={`https://www.imdb.com/title/${show.imdbId}/`}
							target="_blank"
							rel="noopener noreferrer"
						>
							<ExternalLinkIcon size={18} aria-hidden="true" />
							IMDb page
						</Button>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<div class="body">
		<section class="story" aria-labelledby="story-heading">
			<h2 id="story-heading">Story</h2>
			<p>{show.overview}</p>
			<dl class="facts">
				<div>
					<dt>First aired</dt>
					<dd>{show.firstYear}</dd>
				</div>
				{#if show.seasons}
					<div>
						<dt>Seasons</dt>
						<dd>{show.seasons}</dd>
					</div>
				{/if}
				<div>
					<dt>IMDb rating</dt>
					<dd>{show.rating.toFixed(1)} / 10</dd>
				</div>
				<div>
					<dt>Chart rank</dt>
					<dd>#{show.rank} of 50</dd>
				</div>
			</dl>
		</section>
	</div>

	{#if data.similar.length}
		<Section title="More like this" eyebrow="Series" seeAllHref="/tv" seeAllLabel="All series">
			<Rail label="More like this">
				{#each data.similar as item (item.id)}
					<PosterCard {...item} />
				{/each}
			</Rail>
		</Section>
	{/if}

	<p class="back">
		<a href="/tv"><ArrowLeftIcon size={16} aria-hidden="true" /> Back to TV</a>
	</p>
</article>

<style>
	.detail {
		padding-bottom: var(--space-8);
	}
	/* The header runs under the translucent top bar, like the film page. */
	.header {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		min-height: min(62dvh, 480px);
		margin-top: calc(-1 * (var(--top-bar-height) + var(--safe-top)));
		overflow: hidden;
		background: var(--surface-canvas);
	}
	.header :global(.backdrop) {
		position: absolute;
		inset: 0;
	}
	/* Lighter than a full black wash: the artwork stays readable, the text keeps AA contrast. */
	.scrim {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to top, var(--surface-canvas) 4%, rgba(8, 9, 11, 0.72) 38%, transparent 78%),
			linear-gradient(to right, rgba(8, 9, 11, 0.6), transparent 60%);
	}
	.header-content {
		position: relative;
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-5);
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: calc(var(--top-bar-height) + var(--safe-top) + var(--space-7)) var(--page-gutter)
			var(--space-6);
	}
	.poster {
		width: 120px;
	}
	.text {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.title {
		font-size: var(--type-display);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: 1.02;
		overflow-wrap: anywhere;
	}
	.rating-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
	}
	.score {
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
		padding: 0.3rem 0.7rem;
		border-radius: var(--radius-full);
		background: var(--brand-muted);
		border: 1px solid var(--brand-border);
	}
	.score-value {
		color: var(--content-primary);
		font-size: var(--text-md);
		font-weight: 800;
	}
	.score-source {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
	}
	.genres {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		list-style: none;
	}
	.genres li {
		padding: 0.35rem 0.85rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
		background: rgba(255, 255, 255, 0.06);
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
	.body {
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: var(--space-7) var(--page-gutter) 0;
	}
	.story {
		max-width: var(--container-reading);
	}
	.story h2 {
		font-size: var(--type-title);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
	}
	.story p {
		margin-top: var(--space-3);
		color: var(--content-secondary);
		font-size: var(--text-lg);
		line-height: 1.7;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--space-4);
		margin-top: var(--space-6);
		padding-top: var(--space-5);
		border-top: 1px solid var(--border-subtle);
	}
	.facts dt {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.facts dd {
		margin-top: 0.3rem;
		font-weight: 700;
	}
	.back {
		max-width: var(--container-wide);
		margin: var(--space-6) auto 0;
		padding-inline: var(--page-gutter);
	}
	.back a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: var(--touch-target);
		color: var(--content-secondary);
		font-weight: 700;
	}
	.back a:hover {
		color: var(--brand-primary);
	}
	@media (min-width: 768px) {
		.header {
			min-height: min(70dvh, 620px);
		}
		.header-content {
			grid-template-columns: clamp(180px, 20vw, 240px) 1fr;
			align-items: end;
			gap: var(--space-7);
			padding-bottom: var(--space-7);
		}
		.poster {
			width: auto;
		}
	}
</style>
