<script lang="ts">
	import type { HeroItem } from '$lib/catalogue/items';
	import Button from '$lib/components/ui/button';
	import Chip from '$lib/components/ui/chip';
	import RatingBadge from '$lib/components/ui/rating-badge';
	import MetaChips from '$lib/components/ui/meta-chips';
	import Section from '$lib/components/ui/section';
	import Rail from '$lib/components/ui/rail';
	import PosterCard from '$lib/components/ui/poster-card';
	import RankedRail from '$lib/components/ui/ranked-rail';
	import HeroCarousel from '$lib/components/ui/hero-carousel';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';

	let selected = $state(['Drama']);

	// Samples carry no images on purpose: every component must look intentional
	// before any artwork arrives.
	const samples: HeroItem[] = [
		{
			id: 'sample-1',
			href: '/kit',
			title: 'Sample title one',
			posterPath: null,
			// Lightest possible artwork: the copy must stay readable over it.
			backdropPath:
				"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'><rect width='16' height='9' fill='%23f3f4f6'/><circle cx='11' cy='3.5' r='3.2' fill='%23ffffff'/></svg>",
			overview: 'A kit sample without images: every component must still look intentional.',
			releaseDate: '2014-11-05',
			runtime: 169,
			rating: 8.4,
			genres: ['Adventure', 'Drama', 'Science Fiction']
		},
		{
			id: 'sample-2',
			href: '/kit',
			title: 'Sample title two',
			posterPath: null,
			backdropPath:
				"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'><rect width='16' height='9' fill='%2311151c'/><circle cx='11' cy='3.5' r='3.2' fill='%231f2937'/></svg>",
			overview: 'Second slide to exercise rotation, dots and the swipe gesture.',
			releaseDate: '1999-03-31',
			runtime: 136,
			rating: 8.7,
			genres: ['Action', 'Science Fiction']
		}
	];

	const posters = Array.from({ length: 10 }, (_, index) => ({
		id: `poster-${index}`,
		href: '/kit',
		title: `Poster ${index + 1}`,
		posterPath: null,
		releaseDate: `${1990 + index}-01-01`,
		rating: 6 + index / 4,
		genre: index % 2 ? 'Drama' : 'Thriller'
	}));

	const tokens: Array<[string, string]> = [
		['--surface-canvas', 'Canvas'],
		['--surface-raised', 'Raised'],
		['--surface-overlay', 'Overlay'],
		['--brand-primary', 'Brand'],
		['--brand-hover', 'Brand hover'],
		['--content-primary', 'Text'],
		['--content-secondary', 'Text secondary'],
		['--content-tertiary', 'Text tertiary'],
		['--color-error', 'Error'],
		['--rating-star', 'Star']
	];
</script>

<svelte:head>
	<title>UI kit | Alan Database</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<HeroCarousel items={samples}>
	{#snippet actions(item)}
		<Button href={item.href} size="lg">Details</Button>
		<Button variant="secondary" size="lg">+ Watchlist</Button>
	{/snippet}
</HeroCarousel>

<div class="kit">
	<Section title="Colour tokens" eyebrow="Tokens">
		<div class="swatches">
			{#each tokens as [token, label] (token)}
				<div class="swatch">
					<span class="chip" style:background={`var(${token})`}></span>
					<span class="label">{label}</span>
					<code>{token}</code>
				</div>
			{/each}
		</div>
	</Section>

	<Section title="Type scale" eyebrow="Tokens">
		<div class="type">
			<p class="t-display">Display</p>
			<p class="t-headline">Headline</p>
			<p class="t-title">Title</p>
			<p class="t-body">Body — Plus Jakarta Sans, 1.6 line height.</p>
			<p class="t-label">Label</p>
		</div>
	</Section>

	<Section title="Buttons" eyebrow="Primitives">
		<div class="row">
			<Button>Primary</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="outline">Outline</Button>
			<Button variant="ghost">Ghost</Button>
			<Button variant="danger">Danger</Button>
			<Button loading>Loading</Button>
			<Button disabled>Disabled</Button>
			<Button href="/kit" variant="outline">As link</Button>
		</div>
		<div class="row">
			<Button size="sm">Small</Button>
			<Button size="md">Medium</Button>
			<Button size="lg">Large</Button>
			<Button size="icon" aria-label="Icon only">★</Button>
		</div>
	</Section>

	<Section title="Chips, badges, meta" eyebrow="Primitives">
		<div class="row">
			{#each ['Drama', 'Thriller', 'Comedy'] as genre (genre)}
				<Chip
					selected={selected.includes(genre)}
					onclick={() =>
						(selected = selected.includes(genre)
							? selected.filter((item) => item !== genre)
							: [...selected, genre])}>{genre}</Chip
				>
			{/each}
			<Chip onremove={() => (selected = [])}>Removable</Chip>
			<Chip href="/kit">Link chip</Chip>
		</div>
		<div class="row">
			<RatingBadge value="8.4" />
			<MetaChips items={['★ 8.4', '2014', '2h 49m', 'Science Fiction']} />
		</div>
	</Section>

	<Section title="Poster rail" eyebrow="Media" seeAllHref="/movies">
		<Rail label="Sample posters">
			{#each posters as item (item.id)}
				<PosterCard {...item} />
			{/each}
		</Rail>
	</Section>

	<Section title="Ranked rail" eyebrow="Media">
		<RankedRail label="Sample ranking" items={posters} />
	</Section>

	<Section title="States" eyebrow="Feedback">
		<div class="row states">
			<div class="skeleton-slot"><Skeleton height="270px" label="Loading poster" /></div>
			<EmptyState title="Nothing here yet" description="Empty states carry a next step." compact />
			<ErrorState title="Something went wrong" description="Error states say what to do." />
		</div>
	</Section>
</div>

<style>
	.kit {
		padding-bottom: var(--space-8);
	}
	.swatches,
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		padding-inline: var(--page-gutter);
	}
	.row + .row {
		margin-top: var(--space-3);
	}
	.states {
		align-items: flex-start;
	}
	.skeleton-slot {
		width: 180px;
	}
	.swatch {
		display: grid;
		gap: 0.25rem;
		width: 9rem;
		font-size: var(--text-xs);
	}
	.chip {
		display: block;
		height: 3rem;
		border-radius: var(--radius-md);
		box-shadow: var(--elevation-1);
	}
	code {
		color: var(--content-tertiary);
		font-family: var(--font-mono);
	}
	.type {
		display: grid;
		gap: var(--space-3);
		padding-inline: var(--page-gutter);
	}
	.t-display {
		font-size: var(--type-display);
		font-weight: 900;
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
	}
	.t-headline {
		font-size: var(--type-headline);
		font-weight: 800;
	}
	.t-title {
		font-size: var(--type-title);
		font-weight: 800;
	}
	.t-body {
		font-size: var(--type-body);
	}
	.t-label {
		font-size: var(--type-label);
		font-weight: 700;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
</style>
