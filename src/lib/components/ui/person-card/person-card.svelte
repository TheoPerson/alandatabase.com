<script lang="ts">
	import { profileImageUrl } from '$lib/tmdb/images';

	interface Props {
		href: string;
		name: string;
		profilePath: string | null;
		subtitle?: string | null;
		/** Fixed width in px; without it the card scales from 104 px (phones) to 148 px (wide). */
		width?: number;
		class?: string;
	}

	let { href, name, profilePath, subtitle = null, width, class: className = '' }: Props = $props();

	const src = $derived(profileImageUrl(profilePath));
	const initials = $derived(
		name
			.split(/\s+/u)
			.slice(0, 2)
			.map((part) => part[0] ?? '')
			.join('')
			.toUpperCase()
	);
	let failed = $state(false);
</script>

<a
	{href}
	class="person {className}"
	style:width={width ? `${width}px` : undefined}
	data-sveltekit-preload-data="hover"
>
	<span class="photo">
		{#if src && !failed}
			<img
				{src}
				alt=""
				width="185"
				height="278"
				loading="lazy"
				decoding="async"
				onerror={() => (failed = true)}
			/>
		{:else}
			<span class="initials" aria-hidden="true">{initials}</span>
		{/if}
	</span>
	<span class="name">{name}</span>
	{#if subtitle}<span class="subtitle">{subtitle}</span>{/if}
</a>

<style>
	.person {
		display: flex;
		flex: 0 0 auto;
		flex-direction: column;
		gap: 0.35rem;
		width: clamp(104px, 28vw, 148px);
		border-radius: var(--radius-md);
		outline-offset: 4px;
	}
	.photo {
		display: block;
		aspect-ratio: 2 / 3;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		box-shadow: var(--elevation-1);
		transition: transform var(--duration-base) var(--ease-out);
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.initials {
		display: grid;
		place-items: center;
		height: 100%;
		color: var(--content-tertiary);
		font-size: var(--text-lg);
		font-weight: 800;
	}
	.name {
		overflow: hidden;
		font-size: var(--text-sm);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.subtitle {
		overflow: hidden;
		color: var(--content-tertiary);
		font-size: var(--text-xs);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	@media (hover: hover) {
		.person:hover .photo,
		.person:focus-visible .photo {
			transform: translateY(-4px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.photo {
			transition: none;
		}
	}
</style>
