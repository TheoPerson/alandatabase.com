<script lang="ts">
	import MovieCard from '$lib/components/movie/MovieCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Button from '$lib/components/ui/button';
	import { addToast } from '$lib/stores/toast';
	import { formatDate } from '$lib/format';
	import { tmdbImageUrl } from '$lib/tmdb/images';
	import { jsonLdScript } from '$lib/seo/json-ld';
	import Share2Icon from 'lucide-svelte/icons/share-2';

	let { data } = $props();
	const person = $derived(data.person);

	const canonicalUrl = $derived(`https://alandatabase.com/people/${person.id}`);
	const biography = $derived(person.biography || `${person.name} film and television credits.`);
	const profileImage = $derived(tmdbImageUrl(person.profilePath, 'w500'));
	// The portrait is the page's hero: sharp at 3x on a phone and 2x on a desktop.
	const profileSrcSet = $derived.by(() => {
		const sizes: Array<[string, number]> = [
			['w185', 185],
			['h632', 421],
			['original', 2000]
		];
		const entries = sizes
			.map(([size, width]) => {
				const url = tmdbImageUrl(person.profilePath, size);
				return url ? `${url} ${width}w` : null;
			})
			.filter(Boolean);
		return entries.length ? entries.join(', ') : undefined;
	});
	const born = $derived(
		[formatDate(person.birthday), person.placeOfBirth].filter(Boolean).join(' · ')
	);
	const knownFor = $derived.by(() => {
		const roles = [...(person.castRoles ?? []), ...(person.crewRoles ?? [])];
		return roles
			.filter(
				(role, index) =>
					role.movie &&
					roles.findIndex((candidate) => candidate.movie?.id === role.movie.id) === index
			)
			.slice(0, 18);
	});
	const structuredPerson = $derived({
		'@context': 'https://schema.org',
		'@type': 'Person',
		name: person.name,
		url: canonicalUrl,
		image: profileImage || undefined,
		description: person.biography || undefined,
		birthDate: person.birthday || undefined,
		birthPlace: person.placeOfBirth || undefined
	});
	const structuredPersonJson = $derived(jsonLdScript(structuredPerson));

	// Long biographies open on four lines; "More" shows the rest in place.
	let bioOpen = $state(false);
	let bioClamped = $state(false);
	let bioEl = $state<HTMLParagraphElement | null>(null);
	$effect(() => {
		const el = bioEl;
		if (!el || bioOpen) return;
		const measure = () => (bioClamped = el.scrollHeight > el.clientHeight + 1);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	});

	async function share() {
		try {
			if (navigator.share) {
				await navigator.share({ title: person.name, url: canonicalUrl });
				return;
			}
			await navigator.clipboard.writeText(canonicalUrl);
			addToast('Link copied', 'success');
		} catch (err) {
			if ((err as { name?: string })?.name === 'AbortError') return;
			addToast('Could not share this page.', 'error');
		}
	}
</script>

<svelte:head>
	<title>{person.name} | Alan Database</title>
	<meta name="description" content={biography.slice(0, 155)} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:title" content={`${person.name} | Alan Database`} />
	<meta property="og:description" content={biography.slice(0, 155)} />
	<meta property="og:type" content="profile" />
	<meta property="og:url" content={canonicalUrl} />
	{#if profileImage}<meta property="og:image" content={profileImage} />{/if}
	<meta name="twitter:card" content={profileImage ? 'summary_large_image' : 'summary'} />
	<!-- Safe: jsonLdScript escapes < > & and line separators; see src/lib/seo/json-ld.ts -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html structuredPersonJson}
</svelte:head>

<article class="person-page container">
	<header class="person-header">
		<div class="profile-frame">
			{#if profileImage}
				<img
					src={profileImage}
					srcset={profileSrcSet}
					sizes="(min-width: 1024px) 350px, (min-width: 701px) 280px, (orientation: landscape) and (max-height: 500px) 107px, 132px"
					alt={person.name}
					width="500"
					height="750"
					decoding="async"
					fetchpriority="high"
				/>
			{:else}
				<div class="profile-fallback" aria-hidden="true">{person.name.slice(0, 1)}</div>
			{/if}
		</div>
		<div class="person-copy">
			<p class="eyebrow-pill">Person</p>
			<h1>{person.name}</h1>
			{#if person.knownForDepartment || born}
				<ul class="meta">
					{#if person.knownForDepartment}<li>{person.knownForDepartment}</li>{/if}
					{#if born}<li>Born {born}</li>{/if}
				</ul>
			{/if}
			<div class="actions">
				<Button variant="secondary" onclick={share}>
					<Share2Icon size={18} aria-hidden="true" />
					<span>Share</span>
				</Button>
			</div>
		</div>
		{#if person.biography}
			<div class="bio">
				<h2 class="h sr-only">Biography</h2>
				<p id="person-bio" class="biography" class:open={bioOpen} bind:this={bioEl}>
					{person.biography}
				</p>
				{#if bioClamped || bioOpen}
					<button
						type="button"
						class="more"
						aria-expanded={bioOpen}
						aria-controls="person-bio"
						onclick={() => (bioOpen = !bioOpen)}
					>
						{bioOpen ? 'Less' : 'More'}
					</button>
				{/if}
			</div>
		{/if}
	</header>

	<section class="credits" aria-labelledby="known-for-heading">
		<h2 class="h" id="known-for-heading">Known for</h2>
		{#if knownFor.length > 0}
			<div class="credit-grid">
				{#each knownFor as role (role.movie.id)}
					<MovieCard
						id={role.movie.id}
						title={role.movie.title}
						posterPath={role.movie.posterPath}
						releaseDate={role.movie.releaseDate}
						voteAverage={role.movie.voteAverage}
					/>
				{/each}
			</div>
		{:else}
			<EmptyState
				title="No published credits yet"
				description="Credits appear here after the related movie records pass review."
				compact
			/>
		{/if}
	</section>
</article>

<style>
	.person-page {
		padding-top: var(--space-6);
		padding-bottom: var(--space-8);
	}

	/* Phones: a 132 px portrait beside the name, like the film hero; the biography runs below. */
	.person-header {
		display: grid;
		grid-template-columns: 132px minmax(0, 1fr);
		grid-template-areas:
			'photo copy'
			'bio bio';
		gap: var(--space-5) var(--space-4);
		align-items: end;
	}

	.profile-frame {
		grid-area: photo;
		aspect-ratio: 2 / 3;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		box-shadow: var(--shadow-lg);
	}

	.profile-frame img,
	.profile-fallback {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.profile-fallback {
		display: grid;
		place-items: center;
		color: var(--content-tertiary);
		font-size: var(--type-headline);
		font-weight: 700;
	}

	.person-copy {
		grid-area: copy;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		min-width: 0;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	/* The same kind pill as the film and series heroes. */
	.eyebrow-pill {
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--brand-border);
		border-radius: var(--radius-full);
		background: var(--brand-muted);
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}

	/* One title ramp for every title page: 36 to 72 px, weight 700. */
	h1 {
		font-size: var(--type-display);
		font-weight: 700;
		line-height: var(--leading-tight);
		letter-spacing: var(--tracking-tight);
		overflow-wrap: anywhere;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0;
		list-style: none;
		color: var(--content-secondary);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.meta li + li::before {
		content: '·';
		margin: 0 0.6rem;
		color: var(--content-tertiary);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.bio {
		grid-area: bio;
		display: grid;
		justify-items: start;
		gap: var(--space-1);
	}

	.biography {
		max-inline-size: 62ch;
		color: var(--content-secondary);
		font-size: var(--text-md);
		line-height: var(--leading-body);
		white-space: pre-line;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.biography.open {
		display: block;
		overflow: visible;
	}

	.more {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-target);
		color: var(--content-primary);
		font-size: var(--text-sm);
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.more:focus-visible {
		outline: 2px solid var(--brand-primary);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.credits {
		margin-top: var(--space-7);
	}

	/* Same section heading as the film and series pages. */
	.h {
		margin-bottom: var(--space-4);
		font-size: var(--type-title);
		font-weight: 800;
		letter-spacing: var(--tracking-tight);
	}

	.credit-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(10rem, 42vw), 1fr));
		gap: clamp(1rem, 2vw, 1.5rem);
	}

	/* Phone landscape: the same row, the portrait capped at 160 px high. */
	@media (orientation: landscape) and (max-height: 500px) {
		.person-page {
			padding-top: var(--space-4);
		}
		.person-header {
			grid-template-columns: 107px minmax(0, 1fr);
		}
	}

	@media (min-width: 701px) and (min-height: 501px) {
		.person-page {
			padding-top: var(--space-7);
		}
		.person-header {
			grid-template-columns: 280px minmax(0, 1fr);
			grid-template-areas:
				'photo copy'
				'photo bio';
			grid-template-rows: 1fr auto;
			column-gap: var(--space-7);
			row-gap: var(--space-5);
			align-items: start;
		}
		.person-copy {
			align-self: end;
		}
		.biography {
			font-size: var(--text-lg);
			line-height: 1.7;
		}
	}

	@media (min-width: 1024px) and (min-height: 501px) {
		.person-header {
			grid-template-columns: 350px minmax(0, 1fr);
			column-gap: var(--space-8);
		}
	}
</style>
