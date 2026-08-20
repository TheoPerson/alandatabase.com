<script lang="ts">
	import ShieldCheckIcon from 'lucide-svelte/icons/shield-check';

	const {
		title,
		context,
		actionHref = '/movies',
		actionLabel = 'Browse the library',
		compact = false
	} = $props<{
		title: string;
		context?: string;
		actionHref?: string;
		actionLabel?: string;
		compact?: boolean;
	}>();
</script>

<section class:compact class="playback-state" aria-label={`Playback unavailable for ${title}`}>
	<div class="status-mark" aria-hidden="true">
		<ShieldCheckIcon size={24} strokeWidth={1.8} />
	</div>
	<p class="eyebrow">Playback unavailable</p>
	<h2>No approved source for {title}</h2>
	<p class="description">
		{context ||
			'Playback is unavailable until an owner-approved source is connected. Untrusted mirrors are blocked to protect your account and device.'}
	</p>
	<a class="state-action" href={actionHref}>{actionLabel}</a>
</section>

<style>
	.playback-state {
		box-sizing: border-box;
		width: 100%;
		min-height: clamp(19rem, 45vw, 34rem);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: clamp(1.5rem, 5vw, 4rem);
		text-align: center;
		background:
			radial-gradient(circle at 50% 25%, rgba(16, 185, 129, 0.09), transparent 38%), #050507;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1rem;
		color: #f4f4f5;
	}

	.playback-state.compact {
		min-height: 18rem;
		border: 0;
		border-radius: 0;
	}

	.status-mark {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		margin-bottom: 0.25rem;
		border: 1px solid rgba(52, 211, 153, 0.35);
		border-radius: 999px;
		background: rgba(16, 185, 129, 0.1);
		color: #34d399;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #34d399;
	}

	h2 {
		max-width: 34rem;
		margin: 0;
		font-size: clamp(1.25rem, 4vw, 2rem);
		line-height: 1.15;
		letter-spacing: -0.03em;
		text-wrap: balance;
	}

	.description {
		max-width: 38rem;
		margin: 0;
		font-size: clamp(0.9rem, 2vw, 1rem);
		line-height: 1.65;
		color: #a1a1aa;
		text-wrap: pretty;
	}

	.state-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		margin-top: 0.5rem;
		padding: 0.7rem 1rem;
		border: 1px solid rgba(52, 211, 153, 0.45);
		border-radius: 999px;
		background: rgba(16, 185, 129, 0.1);
		color: #6ee7b7;
		font-size: 0.9rem;
		font-weight: 700;
		text-decoration: none;
		transition:
			background 150ms ease,
			border-color 150ms ease,
			color 150ms ease;
	}

	.state-action:hover {
		background: rgba(16, 185, 129, 0.18);
		border-color: #34d399;
		color: #ecfdf5;
	}

	.state-action:focus-visible {
		outline: 3px solid rgba(52, 211, 153, 0.45);
		outline-offset: 3px;
	}

	@media (max-width: 420px) {
		.playback-state {
			min-height: 21rem;
			padding: 1.5rem 1rem;
			border-radius: 0.75rem;
		}
	}
</style>
