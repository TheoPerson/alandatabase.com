<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { addToast } from '$lib/stores/toast';
	import {
		formatDate,
		formatMoney,
		formatRating,
		formatRuntime,
		formatVotes,
		formatYear
	} from '$lib/format';
	import { logoSrcSet, tmdbImageUrl } from '$lib/tmdb/images';
	import { formatTime } from '$lib/player/format-time';
	import { readResume, type ResumePoint } from '$lib/player/resume';
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import Section from '$lib/components/ui/section';
	import Rail from '$lib/components/ui/rail';
	import PosterCard from '$lib/components/ui/poster-card';
	import BackdropImage from '$lib/components/ui/backdrop-image';
	import MetaChips from '$lib/components/ui/meta-chips';
	import Tabs from '$lib/components/ui/tabs';
	import Sheet from '$lib/components/ui/sheet';
	import PersonCard from '$lib/components/ui/person-card';
	import TrailerFacade from '$lib/components/ui/trailer-facade';
	import ProviderLogo from '$lib/components/ui/provider-logo';
	import StarRating from '$lib/components/ui/star-rating';
	import ResumeBar from '$lib/components/ui/resume-bar';
	import PlayerShell from '$lib/components/ui/player';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PlayIcon from 'lucide-svelte/icons/play';
	import BookmarkIcon from 'lucide-svelte/icons/bookmark';
	import BookmarkCheckIcon from 'lucide-svelte/icons/bookmark-check';
	import HeartIcon from 'lucide-svelte/icons/heart';
	import EyeIcon from 'lucide-svelte/icons/eye';
	import CircleCheckIcon from 'lucide-svelte/icons/circle-check';
	import StarIcon from 'lucide-svelte/icons/star';
	import Share2Icon from 'lucide-svelte/icons/share-2';
	import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
	import LayersIcon from 'lucide-svelte/icons/layers';
	import { jsonLdScript } from '$lib/seo/json-ld';

	let { data } = $props();

	type ToggleType = 'watchlist' | 'favorite' | 'watched';
	type Interaction = NonNullable<typeof data.interaction>;
	const EMPTY_INTERACTION: Interaction = {
		watched: false,
		watchlist: false,
		favorite: false,
		rating: null
	};

	const TAB_ITEMS = $derived([
		{ value: 'overview', label: 'Overview' },
		{ value: 'cast', label: 'Cast & crew' },
		{ value: 'videos', label: 'Videos' },
		{ value: 'details', label: 'Details' },
		...(data.saga || data.similar.length ? [{ value: 'more', label: 'Saga & similar' }] : [])
	]);

	let tab = $state('overview');
	let region = $state<'FR' | 'US'>('FR');
	let rateOpen = $state(false);
	let wide = $state(false);
	let pending = $state<string | null>(null);
	let interaction = $state<Interaction | null>(null);
	let draftRating = $state<number | null>(null);
	let resume = $state<ResumePoint | null>(null);

	// The server state is the truth; optimistic flips are reverted when the save fails.
	$effect(() => {
		interaction = data.interaction;
	});

	// Hash, region and resume are client-only facts read once the page is on screen.
	$effect(() => {
		const hash = page.url.hash.replace('#', '');
		if (TAB_ITEMS.some((item) => item.value === hash)) tab = hash;
	});

	$effect(() => {
		try {
			const stored = localStorage.getItem('ui:region');
			if (stored === 'US' || stored === 'FR') region = stored;
		} catch {
			// Storage can be unavailable; the default region stands.
		}
		const media = window.matchMedia('(min-width: 768px)');
		const apply = () => (wide = media.matches);
		apply();
		media.addEventListener('change', apply);
		return () => media.removeEventListener('change', apply);
	});

	$effect(() => {
		const key = data.trailers[0]?.key;
		resume = key ? readResume(localStorage, key, Date.now()) : null;
	});

	function selectTab(value: string) {
		tab = value;
		replaceState(`#${value}`, page.state);
	}

	function setRegion(next: 'FR' | 'US') {
		region = next;
		try {
			localStorage.setItem('ui:region', next);
		} catch {
			// ignore
		}
	}

	const logo = $derived(logoSrcSet(data.hero.logoPath));
	const score = $derived(formatRating(data.hero.rating));
	const votes = $derived(formatVotes(data.voteCount));
	const meta = $derived([
		score ? `★ ${score}${votes ? ` (${votes})` : ''}` : null,
		formatYear(data.hero.releaseDate),
		formatRuntime(data.hero.runtime)
	]);
	const loginHref = $derived(
		`/auth/login?returnTo=${encodeURIComponent(`/movies/${data.hero.id}`)}`
	);
	const firstTrailer = $derived(data.trailers[0] ?? null);
	const groups = $derived(data.providers[region]);
	const providerRows = $derived(
		[
			['Stream', groups.stream],
			['Free', groups.free],
			['Rent', groups.rent],
			['Buy', groups.buy]
		].filter(([, rows]) => rows.length > 0) as Array<[string, typeof groups.stream]>
	);
	const canonicalUrl = $derived(`https://alandatabase.com/movies/${data.hero.id}`);
	const metaDescription = $derived(
		(data.overview || `Explore ${data.hero.title} on Alan Database.`).slice(0, 155)
	);
	const socialImage = $derived(
		tmdbImageUrl(data.hero.backdropPath, 'w1280') ?? tmdbImageUrl(data.posterPath, 'w780')
	);
	const structuredMovieJson = $derived.by(() => {
		const value: Record<string, unknown> = {
			'@context': 'https://schema.org',
			'@type': 'Movie',
			name: data.hero.title,
			url: canonicalUrl,
			description: data.overview || undefined,
			image: socialImage || undefined,
			dateCreated: data.details.releaseDate || undefined,
			actor: data.cast.slice(0, 10).map((person) => ({
				'@type': 'Person',
				name: person.name,
				url: `https://alandatabase.com/people/${person.id}`
			})),
			director: data.keyCrew
				.filter((entry) => entry.role === 'Director')
				.map((entry) => ({
					'@type': 'Person',
					name: entry.name,
					url: `https://alandatabase.com/people/${entry.personId}`
				}))
		};
		if (data.details.runtime) value.duration = `PT${Math.trunc(data.details.runtime)}M`;
		const rating = Number(data.hero.rating);
		if (Number.isFinite(rating) && rating > 0 && data.voteCount) {
			value.aggregateRating = {
				'@type': 'AggregateRating',
				ratingValue: rating,
				bestRating: 10,
				ratingCount: data.voteCount
			};
		}
		return jsonLdScript(value);
	});

	function toggleLabel(type: ToggleType, on: boolean): string {
		if (type === 'watchlist') return on ? 'In watchlist' : 'Watchlist';
		if (type === 'favorite') return on ? 'Favourited' : 'Favourite';
		return on ? 'Watched' : 'Mark watched';
	}

	// Toast copy comes from the saved state the server returned, never from the click.
	function toggleToast(type: ToggleType, saved: Interaction): string {
		const title = data.hero.title;
		if (type === 'watchlist') {
			return saved.watchlist
				? `${title} added to your watchlist`
				: `${title} removed from your watchlist`;
		}
		if (type === 'favorite') {
			return saved.favorite ? `${title} added to favourites` : `${title} removed from favourites`;
		}
		return saved.watched ? `${title} marked as watched` : `${title} marked as not watched`;
	}

	function submitToggle(type: ToggleType) {
		return () => {
			const previous = interaction;
			const base = interaction ?? EMPTY_INTERACTION;
			pending = type;
			interaction = { ...base, [type]: !base[type] };
			return async ({
				result,
				update
			}: {
				result: { type: string; data?: unknown };
				update: (options?: { reset?: boolean }) => Promise<void>;
			}) => {
				pending = null;
				const saved = (result.data as { interaction?: Interaction } | undefined)?.interaction;
				if (result.type === 'success' && saved) {
					interaction = saved;
					addToast(toggleToast(type, saved), 'success');
					await update({ reset: false });
				} else {
					interaction = previous;
					addToast('That could not be saved. Please try again.', 'error');
				}
			};
		};
	}

	function openRate() {
		draftRating = interaction?.rating ?? null;
		rateOpen = true;
	}

	function submitRating() {
		pending = 'rating';
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: unknown };
			update: (options?: { reset?: boolean }) => Promise<void>;
		}) => {
			pending = null;
			const saved = (result.data as { interaction?: Interaction } | undefined)?.interaction;
			if (result.type === 'success' && saved) {
				interaction = saved;
				rateOpen = false;
				addToast(saved.rating === null ? 'Rating cleared' : `Rated ${saved.rating} / 5`, 'success');
				await update({ reset: false });
			} else {
				addToast('The rating could not be saved. Please try again.', 'error');
			}
		};
	}

	async function share() {
		try {
			if (navigator.share) {
				await navigator.share({ title: data.hero.title, url: canonicalUrl });
				return;
			}
			await navigator.clipboard.writeText(canonicalUrl);
			addToast('Link copied', 'success');
		} catch (err) {
			if ((err as { name?: string })?.name === 'AbortError') return;
			addToast('Could not share this page.', 'error');
		}
	}

	let playerOpen = $state(false);
	let playerKey = $state('');

	function openTrailer(key: string) {
		playerKey = key;
		playerOpen = true;
	}

	// Re-read the saved position once the player closes so the Play button stays truthful.
	function onPlayerClose() {
		const key = data.trailers[0]?.key;
		try {
			resume = key ? readResume(localStorage, key, Date.now()) : null;
		} catch {
			resume = null;
		}
	}
</script>

<svelte:head>
	<title>{data.hero.title} | Alan Database</title>
	<meta name="description" content={metaDescription} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:title" content={`${data.hero.title} | Alan Database`} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:type" content="video.movie" />
	<meta property="og:url" content={canonicalUrl} />
	{#if socialImage}<meta property="og:image" content={socialImage} />{/if}
	<meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
	<!-- Safe: jsonLdScript escapes < > & and line separators; see src/lib/seo/json-ld.ts -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html structuredMovieJson}
</svelte:head>

<article class="detail">
	<header class="header">
		<BackdropImage
			path={data.hero.backdropPath}
			eager
			animate={false}
			priority="low"
			sizes="100vw"
		/>
		<div class="scrim" aria-hidden="true"></div>
		<div class="header-content">
			<div class="poster">
				<PosterCard
					id={data.hero.id}
					title={data.hero.title}
					posterPath={data.posterPath}
					eager
					sizes="280px"
				/>
			</div>
			<div class="text">
				<div class="title-box">
					{#if logo}
						<img
							class="logo"
							src={logo.src}
							srcset={logo.srcset || undefined}
							sizes="(min-width: 1024px) 420px, 70vw"
							alt=""
							width="500"
							height="200"
							loading="eager"
							decoding="async"
						/>
						<h1 class="sr-only">{data.hero.title}</h1>
					{:else}
						<h1 class="title">{data.hero.title}</h1>
					{/if}
				</div>
				{#if data.tagline}<p class="tagline">{data.tagline}</p>{/if}
				<MetaChips items={meta} class="meta" />
				{#if data.genres.length}
					<div class="genres">
						{#each data.genres as genre (genre.id)}
							<Chip href={`/movies/catalog?genre=${genre.id}`}>{genre.name}</Chip>
						{/each}
					</div>
				{/if}

				<div class="actions" role="group" aria-label="Actions">
					{#if firstTrailer}
						<Button size="lg" class="play" onclick={() => openTrailer(firstTrailer.key)}>
							<PlayIcon size={20} aria-hidden="true" />
							{#if resume}
								<span>Resume · {formatTime(resume.duration - resume.position)} left</span>
								<ResumeBar position={resume.position} duration={resume.duration} />
							{:else}
								<span>Play trailer</span>
							{/if}
						</Button>
					{:else}
						<span class="no-trailer">No trailer yet</span>
					{/if}

					{#each ['watchlist', 'favorite', 'watched'] as const as type (type)}
						{@const on = Boolean(interaction?.[type])}
						{#if data.user}
							<form method="POST" action="?/logInteraction" use:enhance={submitToggle(type)}>
								<input type="hidden" name="type" value={type} />
								<input type="hidden" name="value" value={String(!on)} />
								<Button
									type="submit"
									variant="secondary"
									class="toggle"
									aria-pressed={on}
									loading={pending === type}
								>
									{#if type === 'watchlist'}
										{#if on}<BookmarkCheckIcon size={18} aria-hidden="true" />{:else}<BookmarkIcon
												size={18}
												aria-hidden="true"
											/>{/if}
									{:else if type === 'favorite'}
										<HeartIcon size={18} aria-hidden="true" fill={on ? 'currentColor' : 'none'} />
									{:else if on}
										<CircleCheckIcon size={18} aria-hidden="true" />
									{:else}
										<EyeIcon size={18} aria-hidden="true" />
									{/if}
									<span>{toggleLabel(type, on)}</span>
								</Button>
							</form>
						{:else}
							<Button href={loginHref} variant="secondary" class="toggle">
								{#if type === 'watchlist'}<BookmarkIcon
										size={18}
										aria-hidden="true"
									/>{:else if type === 'favorite'}<HeartIcon
										size={18}
										aria-hidden="true"
									/>{:else}<EyeIcon size={18} aria-hidden="true" />{/if}
								<span>{toggleLabel(type, false)}</span>
							</Button>
						{/if}
					{/each}

					{#if data.user}
						<Button variant="secondary" class="toggle" onclick={openRate} aria-haspopup="dialog">
							<StarIcon
								size={18}
								aria-hidden="true"
								fill={interaction?.rating ? 'currentColor' : 'none'}
							/>
							<span>{interaction?.rating ? `${interaction.rating} / 5` : 'Rate'}</span>
						</Button>
					{:else}
						<Button href={loginHref} variant="secondary" class="toggle">
							<StarIcon size={18} aria-hidden="true" />
							<span>Rate</span>
						</Button>
					{/if}
					<Button variant="ghost" class="toggle share" onclick={share}>
						<Share2Icon size={18} aria-hidden="true" />
						<span>Share</span>
					</Button>
				</div>
			</div>
		</div>
	</header>

	<div class="body">
		<Tabs bind:value={tab} items={TAB_ITEMS} label="Film sections" onValueChange={selectTab}>
			{#snippet children(value)}
				{#if value === 'overview'}
					<div class="overview">
						<div class="synopsis-col">
							<h2 class="h">Synopsis</h2>
							{#if data.overview}
								<p class="synopsis">{data.overview}</p>
							{:else}
								<p class="muted">No synopsis yet.</p>
							{/if}
							{#if data.keyCrew.length}
								<dl class="crew-key">
									{#each data.keyCrew as entry (entry.role)}
										<div>
											<dt>{entry.role}</dt>
											<dd><a href={`/people/${entry.personId}`}>{entry.name}</a></dd>
										</div>
									{/each}
								</dl>
							{/if}
							{#if data.saga}
								<a class="saga-banner" href="#more" onclick={() => selectTab('more')}>
									<LayersIcon size={18} aria-hidden="true" />
									<span>Part of <strong>{data.saga.name}</strong></span>
								</a>
							{/if}
						</div>
						<aside class="watch" aria-labelledby="watch-h">
							<div class="watch-head">
								<div>
									<p class="eyebrow">{region === 'FR' ? 'France' : 'United States'}</p>
									<h2 class="h" id="watch-h">Where to watch</h2>
								</div>
								<div class="region" role="group" aria-label="Region">
									{#each ['FR', 'US'] as const as code (code)}
										<Chip selected={region === code} onclick={() => setRegion(code)}>{code}</Chip>
									{/each}
								</div>
							</div>
							{#if groups.empty}
								<p class="muted">
									Not streaming in {region === 'FR' ? 'France' : 'the United States'} right now.
								</p>
							{:else}
								{#each providerRows as [label, rows] (label)}
									<h3 class="kind">{label}</h3>
									<div class="providers">
										{#each rows as row (row.providerId)}
											<ProviderLogo
												providerName={row.providerName}
												logoPath={row.logoPath}
												href={groups.link}
											/>
										{/each}
									</div>
								{/each}
							{/if}
							<p class="attribution">
								Data by JustWatch{#if groups.link}
									· <a href={groups.link} target="_blank" rel="noopener"
										>See all options on TMDB <ExternalLinkIcon size={12} aria-hidden="true" /></a
									>{/if}
							</p>
						</aside>
					</div>
				{:else if value === 'cast'}
					{#if data.cast.length}
						<h2 class="h">Cast</h2>
						<div class="bleed">
							<Rail label="Cast">
								{#each data.cast as person (person.id)}
									<PersonCard
										href={`/people/${person.id}`}
										name={person.name}
										profilePath={person.profilePath}
										subtitle={person.character}
									/>
								{/each}
							</Rail>
						</div>
					{/if}
					{#if data.crewByDepartment.length}
						<h2 class="h crew-h">Crew</h2>
						<div class="crew-grid">
							{#each data.crewByDepartment as group (group.department)}
								<section>
									<h3>{group.department}</h3>
									<ul>
										{#each group.people as person (person.id + person.job)}
											<li>
												<a href={`/people/${person.id}`}>{person.name}</a>
												{#if person.job}<span class="muted"> · {person.job}</span>{/if}
											</li>
										{/each}
									</ul>
								</section>
							{/each}
						</div>
					{/if}
					{#if !data.cast.length && !data.crewByDepartment.length}
						<EmptyState title="No credits yet" compact />
					{/if}
				{:else if value === 'videos'}
					{#if data.trailers.length}
						<div class="videos">
							{#each data.trailers as trailer (trailer.key)}
								<TrailerFacade
									videoKey={trailer.key}
									name={trailer.name}
									kind={trailer.type}
									resume={resume && firstTrailer?.key === trailer.key ? resume : null}
									onplay={openTrailer}
								/>
							{/each}
						</div>
					{:else}
						<EmptyState title="No trailer yet" compact />
					{/if}
				{:else if value === 'details'}
					<dl class="details">
						{#if formatDate(data.details.releaseDate)}
							<dt>Release date</dt>
							<dd>{formatDate(data.details.releaseDate)}</dd>
						{/if}
						{#if formatRuntime(data.details.runtime)}
							<dt>Runtime</dt>
							<dd>{formatRuntime(data.details.runtime)}</dd>
						{/if}
						{#if data.details.originalTitle && data.details.originalTitle !== data.hero.title}
							<dt>Original title</dt>
							<dd>{data.details.originalTitle}</dd>
						{/if}
						{#if data.details.originalLanguage}
							<dt>Language</dt>
							<dd class="upper">{data.details.originalLanguage}</dd>
						{/if}
						{#if data.details.status}
							<dt>Status</dt>
							<dd>{data.details.status}</dd>
						{/if}
						{#if formatMoney(data.details.budget)}
							<dt>Budget</dt>
							<dd>{formatMoney(data.details.budget)}</dd>
						{/if}
						{#if formatMoney(data.details.revenue)}
							<dt>Revenue</dt>
							<dd>{formatMoney(data.details.revenue)}</dd>
						{/if}
						<dt>Links</dt>
						<dd class="links">
							<a
								href={`https://www.themoviedb.org/movie/${data.details.tmdbId}`}
								target="_blank"
								rel="noopener">TMDB <ExternalLinkIcon size={12} aria-hidden="true" /></a
							>
							{#if data.details.imdbId}
								<a
									href={`https://www.imdb.com/title/${data.details.imdbId}`}
									target="_blank"
									rel="noopener">IMDb <ExternalLinkIcon size={12} aria-hidden="true" /></a
								>
							{/if}
						</dd>
					</dl>
					{#if data.details.keywords.length}
						<h3 class="kind">Keywords</h3>
						<div class="keywords">
							{#each data.details.keywords as keyword (keyword)}
								<Chip href={`/search?q=${encodeURIComponent(keyword)}`}>{keyword}</Chip>
							{/each}
						</div>
					{/if}
				{:else if value === 'more'}
					{#if data.saga}
						<div class="bleed">
							<Section title={data.saga.name} eyebrow="Saga">
								<Rail label={data.saga.name}>
									{#each data.saga.items as item (item.id)}
										<PosterCard {...item} />
									{/each}
								</Rail>
							</Section>
						</div>
					{/if}
					{#if data.similar.length}
						<div class="bleed">
							<Section title="More like this" eyebrow="Similar">
								<Rail label="More like this">
									{#each data.similar as item (item.id)}
										<PosterCard {...item} />
									{/each}
								</Rail>
							</Section>
						</div>
					{/if}
				{/if}
			{/snippet}
		</Tabs>

		<section class="reviews" aria-labelledby="reviews-h">
			<div class="reviews-head">
				<h2 class="h" id="reviews-h">Reviews</h2>
				{#if data.user}
					<Button href={`/movies/catalog/${data.hero.id}/review`} variant="outline" size="sm">
						Write a review
					</Button>
				{/if}
			</div>
			{#if data.reviews.length}
				<ul class="review-list">
					{#each data.reviews as review (review.id)}
						<li class="review">
							<p class="review-meta">
								<strong>{review.author}</strong>
								{#if formatDate(review.createdAt)}
									<span class="muted"> · {formatDate(review.createdAt)}</span>
								{/if}
								{#if review.containsSpoilers}<span class="spoiler">Spoilers</span>{/if}
							</p>
							<p class="review-body">{review.content}</p>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted">No reviews yet.</p>
			{/if}
		</section>
	</div>
</article>

{#if playerKey}
	<PlayerShell
		bind:open={playerOpen}
		title={data.hero.title}
		videoKey={playerKey}
		onclose={onPlayerClose}
	/>
{/if}

{#if data.user}
	<Sheet bind:open={rateOpen} label="Your rating" side={wide ? 'right' : 'bottom'}>
		<form method="POST" action="?/logInteraction" class="rate-form" use:enhance={submitRating}>
			<input type="hidden" name="type" value="rating" />
			<input type="hidden" name="value" value={draftRating ?? ''} />
			<p class="muted">{data.hero.title}</p>
			<StarRating bind:value={draftRating} name="Your rating" />
			<div class="rate-actions">
				<Button type="submit" loading={pending === 'rating'}>Save rating</Button>
				<Button variant="ghost" onclick={() => (rateOpen = false)}>Cancel</Button>
			</div>
		</form>
	</Sheet>
{/if}

<style>
	.detail {
		padding-bottom: var(--space-8);
	}

	/* ── Header: the hero recipe frozen on one film ─────────────────────── */
	.header {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		min-height: min(56dvh, 400px);
		margin-top: calc(-1 * (var(--top-bar-height) + var(--safe-top)));
		overflow: hidden;
		background: var(--surface-canvas);
	}
	.scrim {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to top, var(--surface-canvas) 0%, rgba(8, 9, 11, 0.55) 40%, transparent 75%),
			linear-gradient(to right, rgba(8, 9, 11, 0.9) 0%, rgba(8, 9, 11, 0.35) 55%, transparent 100%);
	}
	.header-content {
		position: relative;
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-4);
		width: 100%;
		max-width: var(--container-wide);
		margin: 0 auto;
		padding: calc(var(--top-bar-height) + var(--safe-top) + var(--space-5)) var(--page-gutter)
			var(--space-6);
	}
	.poster {
		width: 96px;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
	}
	.title-box {
		min-height: 2.5rem;
	}
	.title {
		font-size: clamp(2rem, 9vw, 2.75rem);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.logo {
		display: block;
		width: auto;
		max-width: min(70vw, 420px);
		height: auto;
		max-height: 6rem;
		object-fit: contain;
		object-position: left bottom;
	}
	.tagline {
		color: var(--content-secondary);
		font-size: var(--text-md);
		font-style: italic;
	}
	.genres {
		display: flex;
		gap: var(--space-2);
		overflow-x: auto;
		scrollbar-width: none;
		margin-inline: calc(-1 * var(--page-gutter));
		padding-inline: var(--page-gutter);
		mask-image: linear-gradient(to right, black calc(100% - 2rem), transparent);
	}
	.genres::-webkit-scrollbar {
		display: none;
	}
	.actions {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.actions :global(.play) {
		position: relative;
		grid-column: 1 / -1;
		overflow: hidden;
		min-height: 3rem;
	}
	.actions :global(.toggle) {
		flex-direction: column;
		justify-content: center;
		gap: 0.3rem;
		min-height: 3.5rem;
		padding: 0.4rem 0.2rem;
		font-size: 0.6875rem;
		letter-spacing: -0.01em;
		line-height: 1.1;
		text-align: center;
		white-space: normal;
	}
	.actions :global(.toggle span) {
		max-width: 100%;
		overflow-wrap: normal;
	}
	/* Five 44 px targets in 288 px: captions shrink a notch instead of breaking mid-word. */
	@media (max-width: 359px) {
		.actions :global(.toggle) {
			padding-inline: 0;
			font-size: 0.625rem;
			letter-spacing: -0.02em;
		}
	}
	.actions form {
		display: contents;
	}
	.no-trailer {
		grid-column: 1 / -1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 3rem;
		border: 1px dashed var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--content-tertiary);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	/* ── Body ───────────────────────────────────────────────────────────── */
	.body {
		max-width: var(--container-wide);
		margin: 0 auto;
		padding-inline: var(--page-gutter);
	}
	.h {
		margin-bottom: var(--space-3);
		font-size: var(--type-title);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
	}
	.crew-h {
		margin-top: var(--space-6);
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.muted {
		color: var(--content-tertiary);
	}
	.upper {
		text-transform: uppercase;
	}
	.bleed {
		margin-inline: calc(-1 * var(--page-gutter));
	}
	.bleed :global(.section) {
		margin-block: 0 var(--space-6);
	}
	.overview {
		display: grid;
		gap: var(--space-6);
	}
	.synopsis {
		color: var(--content-secondary);
		font-size: var(--text-md);
		line-height: var(--leading-body);
		max-width: 65ch;
	}
	.crew-key {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: var(--space-3) var(--space-5);
		margin-top: var(--space-5);
	}
	.crew-key dt {
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.crew-key dd a {
		font-weight: 700;
	}
	.crew-key dd a:hover {
		color: var(--brand-primary);
	}
	.saga-banner {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-5);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		color: var(--content-secondary);
		font-size: var(--text-sm);
	}
	.saga-banner strong {
		color: var(--content-primary);
	}
	.watch {
		min-height: 120px;
		padding: var(--space-5);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
	}
	.watch-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.region {
		display: flex;
		gap: var(--space-2);
	}
	.kind {
		margin: var(--space-4) 0 var(--space-2);
		color: var(--content-secondary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.providers {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.attribution {
		margin-top: var(--space-5);
		color: var(--content-tertiary);
		font-size: var(--text-xs);
	}
	.attribution a {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		color: var(--content-secondary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.crew-grid {
		display: grid;
		gap: var(--space-5);
	}
	.crew-grid h3 {
		margin-bottom: var(--space-2);
		color: var(--content-secondary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	.crew-grid li {
		padding-block: 0.3rem;
		font-size: var(--text-sm);
	}
	.crew-grid a {
		font-weight: 700;
	}
	.crew-grid a:hover {
		color: var(--brand-primary);
	}
	.videos {
		display: grid;
		gap: var(--space-5);
	}
	.details {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-3) var(--space-5);
		max-width: 48rem;
	}
	.details dt {
		color: var(--content-tertiary);
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.details dd {
		min-width: 0;
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
	}
	.links a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.keywords {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.reviews {
		margin-top: var(--space-7);
		padding-top: var(--space-6);
		border-top: 1px solid var(--border-subtle);
	}
	.reviews-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.reviews-head .h {
		margin-bottom: 0;
	}
	.review-list {
		display: grid;
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	.review {
		padding: var(--space-4);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
	}
	.review-meta {
		margin-bottom: var(--space-2);
		font-size: var(--text-sm);
	}
	.spoiler {
		margin-left: var(--space-2);
		padding: 0.1rem 0.5rem;
		border-radius: var(--radius-full);
		background: var(--surface-interactive);
		color: var(--content-secondary);
		font-size: var(--text-xs);
		font-weight: 700;
	}
	.review-body {
		color: var(--content-secondary);
		font-size: var(--text-sm);
		line-height: var(--leading-body);
		white-space: pre-wrap;
	}
	.reviews + .muted {
		margin-top: var(--space-3);
	}
	.rate-form {
		display: grid;
		gap: var(--space-4);
		padding-top: var(--space-2);
	}
	.rate-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	/* ── Breakpoints (brief §2) ─────────────────────────────────────────── */
	@media (min-width: 390px) {
		.header {
			min-height: min(60dvh, 460px);
		}
		.poster {
			width: 112px;
		}
	}
	@media (min-width: 560px) {
		.actions {
			display: flex;
			flex-wrap: wrap;
		}
		.actions :global(.play) {
			flex: 1 1 100%;
		}
		.actions :global(.toggle) {
			flex-direction: row;
			gap: 0.5rem;
			min-height: var(--touch-target);
			padding: 0 var(--space-4);
			font-size: var(--text-sm);
			letter-spacing: normal;
			text-align: left;
		}
		.actions :global(.toggle span) {
			white-space: nowrap;
		}
		.no-trailer {
			flex: 0 0 auto;
			padding-inline: var(--space-4);
		}
	}
	@media (min-width: 768px) {
		.header {
			min-height: min(60dvh, 520px);
		}
		.header-content {
			grid-template-columns: clamp(160px, 22vw, 220px) 1fr;
			align-items: end;
			gap: var(--space-6);
		}
		.poster {
			width: auto;
		}
		.actions :global(.play) {
			flex: 0 0 auto;
			min-width: 12rem;
		}
		.overview {
			grid-template-columns: 1.2fr 1fr;
		}
		.videos {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.crew-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.genres {
			flex-wrap: wrap;
			overflow: visible;
			margin-inline: 0;
			padding-inline: 0;
			mask-image: none;
		}
	}
	@media (min-width: 1024px) {
		.header {
			min-height: min(80dvh, 720px);
		}
		.title {
			font-size: var(--type-display);
		}
		.logo {
			max-height: 8rem;
		}
		.text {
			max-width: 60%;
		}
		.overview {
			grid-template-columns: 7fr 5fr;
			gap: var(--space-8);
		}
	}
	@media (min-width: 1440px) {
		.header-content {
			grid-template-columns: 280px 1fr;
		}
		.videos {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.saga-banner {
			transition: border-color var(--duration-fast) var(--ease-out);
		}
		.saga-banner:hover {
			border-color: var(--border-strong);
		}
	}
</style>
