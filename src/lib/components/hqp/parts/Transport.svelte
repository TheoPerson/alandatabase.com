<script lang="ts">
	import { getHqpContext } from '../context';
	import Icon from './Icon.svelte';

	// Back 10 · play/pause · forward 10 (sections 5.1 to 5.3). Regular glass under the picture in
	// portrait, clear glass over the picture elsewhere. A 2 px emerald arc replaces the glyph after
	// 500 ms of buffering. Large layouts keep only the centre Play of the autoplay-blocked state.
	const ctx = getHqpContext();
	const { snapshot, ui } = ctx;

	const status = $derived($snapshot.status);
	const blocked = $derived($snapshot.autoplayBlocked);
	// Opening (section 8): the still, the title and the hairline line; no transport, no spinner.
	const opening = $derived(
		(status === 'starting' || status === 'loading' || status === 'idle') && !blocked
	);
	const playing = $derived(status === 'playing' || status === 'buffering');
	const overPicture = $derived(!ui.portrait || ui.layout === 'phone-portrait-short');
	const glass = $derived(overPicture ? 'hqp-glass--clear' : 'hqp-glass');

	let spinning = $state(false);
	$effect(() => {
		if (status !== 'buffering') {
			spinning = false;
			return;
		}
		const timer = setTimeout(() => (spinning = true), 500);
		return () => clearTimeout(timer);
	});

	function skip(delta: number) {
		ctx.engine.skip(delta);
		ui.announce(`${delta < 0 ? 'Back' : 'Forward'} 10 seconds`);
		ui.poke();
	}

	function toggle() {
		if (blocked) void ctx.engine.play();
		else ctx.engine.toggle();
		ui.poke();
	}
</script>

{#if (!ui.large || blocked) && !opening}
	<div
		class="hqp-transport hqp-fade hqp-x-scrub hqp-x-upnext hqp-x-error hqp-x-card"
		class:hqp-x-info={ui.portrait || ui.layout === 'phone-landscape'}
		data-over={overPicture ? '' : undefined}
		data-blocked={blocked ? '' : undefined}
	>
		{#if !blocked}
			<button
				type="button"
				class="hqp-btn skip {glass}"
				aria-label="Back 10 seconds"
				onclick={() => skip(-10)}
			>
				<Icon name="back-10" size={30} />
			</button>
		{/if}
		<button
			type="button"
			class="hqp-btn play {blocked ? '' : glass}"
			aria-label={blocked ? 'Play' : playing ? 'Pause' : 'Play'}
			onclick={toggle}
		>
			{#if spinning && !blocked}
				<span class="arc" aria-hidden="true"></span>
				<span class="hqp-sr">Loading</span>
			{:else}
				<Icon name={playing && !blocked ? 'pause' : 'play'} size={34} />
			{/if}
		</button>
		{#if !blocked}
			<button
				type="button"
				class="hqp-btn skip {glass}"
				aria-label="Forward 10 seconds"
				onclick={() => skip(10)}
			>
				<Icon name="forward-10" size={30} />
			</button>
		{/if}
	</div>
{/if}

<style>
	.hqp-transport {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 44px;
		pointer-events: none;
	}
	.hqp-transport > :global(button) {
		pointer-events: auto;
	}
	/* Portrait: the transport follows the picture, under the title block and resume capsule
	   (picture bottom + 156 px), and never sinks below 210 px above the bottom (play centre). */
	:global(.hqp[data-layout='phone-portrait']) .hqp-transport {
		top: min(calc(var(--frame-bottom) + 156px), calc(100cqh - 210px - 38px));
	}
	/* Short portrait: over the picture centre, clear glass, 48 / 64 / 48. */
	:global(.hqp[data-layout='phone-portrait-short']) .hqp-transport {
		top: calc(var(--frame-top) + var(--frame-h) / 2 - 32px);
		gap: 32px;
	}
	/* Landscape: centred, 72 px gaps; shorter than 380 px: 48 / 64 / 48 with 48 px gaps. */
	:global(.hqp[data-layout='phone-landscape']) .hqp-transport,
	:global(.hqp[data-layout='large']) .hqp-transport {
		top: calc(50cqh - 38px);
		gap: 72px;
	}
	:global(.hqp[data-layout='phone-landscape'][data-info]) .hqp-transport {
		translate: -120px 0;
	}
	.hqp-transport > .skip {
		width: 56px;
		height: 56px;
	}
	.hqp-transport > .play {
		width: 76px;
		height: 76px;
	}
	:global(.hqp[data-layout='phone-portrait-short']) .hqp-transport > .skip {
		width: 48px;
		height: 48px;
	}
	:global(.hqp[data-layout='phone-portrait-short']) .hqp-transport > .play {
		width: 64px;
		height: 64px;
	}
	@media (orientation: landscape) and (max-height: 379px) {
		:global(.hqp[data-layout='phone-landscape']) .hqp-transport {
			gap: 48px;
		}
		.hqp-transport > .skip {
			width: 48px;
			height: 48px;
		}
		.hqp-transport > .play {
			width: 64px;
			height: 64px;
		}
		:global(.hqp[data-layout='phone-landscape']) .hqp-transport {
			top: calc(50cqh - 32px);
		}
	}
	.hqp-transport[data-blocked] .play {
		background: var(--hqp-cta);
		color: var(--hqp-ink-on-light);
		box-shadow: var(--hqp-glass-shadow-thick);
	}
	.arc {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 2px solid var(--hqp-track);
		border-top-color: var(--hqp-accent);
		animation: hqp-spin 900ms linear infinite;
	}
	@keyframes hqp-spin {
		to {
			rotate: 360deg;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.arc {
			animation: none;
			border-color: var(--hqp-accent);
		}
		:global(.hqp[data-layout='phone-landscape'][data-info]) .hqp-transport {
			translate: none;
		}
	}
</style>
