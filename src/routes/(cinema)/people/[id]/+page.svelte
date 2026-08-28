<script lang="ts">
	import MovieCard from '$lib/components/movie/MovieCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	let { data } = $props();
	const person = $derived(data.person);
	const canonicalUrl = $derived(`https://alandatabase.com/people/${person.id}`);
	const biography = $derived(person.biography || `${person.name} film and television credits.`);
	const profileImage = $derived(
		person.profilePath ? `https://image.tmdb.org/t/p/w500${person.profilePath}` : null
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
	const structuredPersonJson = $derived(
		JSON.stringify(structuredPerson).replaceAll('<', '\\u003c')
	);
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
	<svelte:element this={"script"} type="application/ld+json">{structuredPersonJson}</svelte:element>
</svelte:head>

<div class="person-page container">
	<a class="back-link" href="/movies">Back to movies</a>
	<header class="person-header">
		<div class="profile-frame">
			{#if profileImage}
				<img src={profileImage} alt={person.name} width="500" height="750" />
			{:else}
				<div class="profile-fallback" aria-hidden="true">{person.name.slice(0, 1)}</div>
			{/if}
		</div>
		<div class="person-copy">
			<p class="eyebrow">Person</p>
			<h1>{person.name}</h1>
			{#if person.knownForDepartment}<p class="department">{person.knownForDepartment}</p>{/if}
			{#if person.placeOfBirth || person.birthday}
				<p class="facts">
					{[person.birthday, person.placeOfBirth].filter(Boolean).join(' / ')}
				</p>
			{/if}
			<p class="biography">{biography}</p>
		</div>
	</header>

	<section class="credits" aria-labelledby="known-for-heading">
		<div class="section-heading">
			<p class="eyebrow">Selected credits</p>
			<h2 id="known-for-heading">Known for</h2>
		</div>
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
</div>

<style>
	.person-page {
		min-height: 100dvh;
		padding-top: clamp(1.5rem, 5vw, 4rem);
		padding-bottom: calc(6rem + env(safe-area-inset-bottom));
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-target);
		color: var(--content-secondary);
		font-size: var(--text-sm);
	}

	.person-header {
		display: grid;
		grid-template-columns: minmax(13rem, 22rem) minmax(0, 1fr);
		gap: clamp(2rem, 6vw, 6rem);
		align-items: end;
		margin-top: var(--space-5);
	}

	.profile-frame {
		aspect-ratio: 2 / 3;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		box-shadow: var(--shadow-lg);
	}

	.profile-frame img,
	.profile-fallback {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.profile-fallback {
		display: grid;
		place-items: center;
		color: var(--content-tertiary);
		font-size: var(--text-display);
	}

	.eyebrow {
		margin: 0 0 var(--space-2);
		color: var(--brand-primary);
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1 {
		font-size: clamp(2.75rem, 8vw, 6.5rem);
		line-height: var(--leading-tight);
		letter-spacing: -0.055em;
	}

	.department,
	.facts {
		margin-top: var(--space-3);
		color: var(--content-secondary);
	}

	.biography {
		max-width: var(--container-reading);
		margin-top: var(--space-5);
		color: var(--content-secondary);
		font-size: var(--text-md);
		line-height: 1.75;
		white-space: pre-line;
	}

	.credits {
		margin-top: clamp(4rem, 9vw, 8rem);
	}

	.section-heading {
		margin-bottom: var(--space-5);
	}

	h2 {
		font-size: var(--text-2xl);
		letter-spacing: -0.035em;
	}

	.credit-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(10rem, 42vw), 1fr));
		gap: clamp(1rem, 2vw, 1.5rem);
	}

	@media (max-width: 700px) {
		.person-header {
			grid-template-columns: 1fr;
			align-items: start;
		}

		.profile-frame {
			width: min(72vw, 18rem);
		}

		.biography {
			font-size: var(--text-sm);
		}
	}
</style>
