<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import XIcon from 'lucide-svelte/icons/x';
	import PlaybackUnavailable from '$lib/components/player/PlaybackUnavailable.svelte';

	const { movie, onClose } = $props<{
		movie: { title: string };
		onClose: () => void;
	}>();

	let closeButton: HTMLButtonElement;
	let dialogElement: HTMLElement;

	onMount(() => {
		const returnFocusTo =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		closeButton.focus();

		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
				return;
			}

			if (event.key !== 'Tab') return;
			const focusable = Array.from(
				dialogElement.querySelectorAll<HTMLElement>(
					'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
				)
			);
			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};

		document.addEventListener('keydown', handleKeydown);

		return () => {
			document.removeEventListener('keydown', handleKeydown);
			document.body.style.overflow = previousOverflow;
			returnFocusTo?.focus();
		};
	});
</script>

<div class="sheet-overlay" transition:fade={{ duration: 160 }}>
	<button class="sheet-backdrop" type="button" aria-label="Close playback dialog" onclick={onClose}
	></button>

	<div
		bind:this={dialogElement}
		class="sheet-content"
		role="dialog"
		aria-modal="true"
		aria-labelledby="playback-dialog-title"
		transition:fly={{ y: 48, duration: 220, opacity: 1 }}
	>
		<header class="sheet-header">
			<div>
				<p class="sheet-eyebrow">Playback status</p>
				<h2 id="playback-dialog-title" class="sheet-title">{movie.title}</h2>
			</div>
			<button
				bind:this={closeButton}
				class="close-btn"
				type="button"
				onclick={onClose}
				aria-label="Close playback dialog"
			>
				<XIcon size={22} />
			</button>
		</header>

		<div class="player-container">
			<PlaybackUnavailable title={movie.title} compact />
		</div>
	</div>
</div>

<style>
	.sheet-overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-top: env(safe-area-inset-top);
	}

	.sheet-backdrop {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		background: rgba(0, 0, 0, 0.82);
		backdrop-filter: blur(8px);
		cursor: default;
	}

	.sheet-content {
		position: relative;
		width: min(100%, 76rem);
		max-height: calc(100dvh - max(1rem, env(safe-area-inset-top)));
		display: flex;
		flex-direction: column;
		background: #08080a;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-bottom: 0;
		border-radius: 1.25rem 1.25rem 0 0;
		box-shadow: 0 -24px 80px rgba(0, 0, 0, 0.65);
		overflow: hidden;
	}

	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem clamp(1rem, 3vw, 1.5rem);
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}

	.sheet-eyebrow {
		margin: 0 0 0.2rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.13em;
		text-transform: uppercase;
		color: #34d399;
	}

	.sheet-title {
		margin: 0;
		font-size: clamp(1rem, 3vw, 1.25rem);
		font-weight: 700;
		color: #fafafa;
	}

	.close-btn {
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		color: #d4d4d8;
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}

	.close-btn:focus-visible {
		outline: 3px solid rgba(52, 211, 153, 0.45);
		outline-offset: 2px;
	}

	.player-container {
		overflow: auto;
		overscroll-behavior: contain;
	}

	@media (min-width: 768px) {
		.sheet-overlay {
			align-items: center;
			padding: 2rem;
		}

		.sheet-content {
			border-bottom: 1px solid rgba(255, 255, 255, 0.1);
			border-radius: 1.25rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet-content,
		.close-btn {
			transition: none;
		}
	}
</style>
