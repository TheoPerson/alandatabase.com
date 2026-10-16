<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Command, Dialog } from 'bits-ui';
	import SearchIcon from 'lucide-svelte/icons/search';
	import XIcon from 'lucide-svelte/icons/x';
	import { palette } from '$lib/search/palette-state.svelte';
	import { createLiveSearch, type LiveSearchState } from '$lib/search/live-search';
	import { buildPaletteModel, type PaletteItem } from '$lib/search/model';
	import { normalizeQuery, searchHref } from '$lib/search/query';
	import {
		clearRecentSearches,
		readRecentSearches,
		saveRecentSearch
	} from '$lib/search/recent-searches';
	import { resolvePaletteShortcut, type EditableCandidate } from '$lib/search/shortcuts';
	import { inertOutside } from '$lib/search/inert';
	import Skeleton from '../Skeleton.svelte';
	import PaletteRow from './palette-row.svelte';

	let query = $state('');
	let recents = $state<string[]>([]);
	let live = $state<LiveSearchState>({ status: 'idle', query: '', hits: [] });
	let inputEl = $state<HTMLInputElement | null>(null);
	let contentEl = $state<HTMLDivElement | null>(null);
	let overlayEl = $state<HTMLDivElement | null>(null);
	let releaseInert: () => void = () => {};

	const search = createLiveSearch({ onChange: (state) => (live = state) });
	const model = $derived(
		buildPaletteModel({ query, recents, status: live.status, hits: live.hits })
	);

	onMount(() => {
		palette.detectPlatform();
		return () => search.dispose();
	});

	// Recent searches are read when the palette opens; closing forgets the draft.
	$effect(() => {
		if (palette.isOpen) {
			recents = readRecentSearches();
		} else {
			query = '';
			search.reset();
		}
	});

	$effect(() => {
		search.setQuery(query);
	});

	// The page behind stays unreachable for keyboard, pointer and screen readers.
	$effect(() => {
		if (!palette.isOpen || !contentEl) return;
		releaseInert = inertOutside(document.body, [contentEl, overlayEl]);
		return () => releaseInert();
	});

	// On phones the on-screen keyboard shrinks the visual viewport, not the layout one:
	// keep the card inside whatever is actually visible.
	$effect(() => {
		const card = contentEl;
		const viewport = window.visualViewport;
		if (!palette.isOpen || !card || !viewport) return;
		const sync = () => {
			card.style.setProperty('--kit-palette-viewport', `${Math.round(viewport.height)}px`);
			card.style.setProperty('--kit-palette-offset', `${Math.round(viewport.offsetTop)}px`);
		};
		sync();
		viewport.addEventListener('resize', sync);
		viewport.addEventListener('scroll', sync);
		return () => {
			viewport.removeEventListener('resize', sync);
			viewport.removeEventListener('scroll', sync);
		};
	});

	function anotherModalIsOpen(): boolean {
		return !!document.querySelector('[role="dialog"][aria-modal="true"]:not([data-kit-palette])');
	}

	function onWindowKeydown(event: KeyboardEvent) {
		const action = resolvePaletteShortcut({
			key: event.key,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			altKey: event.altKey,
			shiftKey: event.shiftKey,
			defaultPrevented: event.defaultPrevented,
			isComposing: event.isComposing,
			repeat: event.repeat,
			target: event.target as EditableCandidate | null
		});
		if (!action || (!palette.isOpen && anotherModalIsOpen())) return;
		event.preventDefault();
		if (action === 'toggle') palette.toggle();
		else palette.open();
	}

	function focusInput(event: Event) {
		// Focus now, inside the click or key press that opened the palette: iOS only
		// raises the keyboard for focus that happens in the same user gesture.
		event.preventDefault();
		if (inputEl) inputEl.focus({ preventScroll: true });
		else requestAnimationFrame(() => inputEl?.focus({ preventScroll: true }));
	}

	function onInputKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
		// With a row active the library activates it; without one, Enter is a plain search.
		if (inputEl?.getAttribute('aria-activedescendant')) return;
		const typed = normalizeQuery(query);
		if (!typed) return;
		event.preventDefault();
		go(searchHref(typed), typed);
	}

	function go(href: string, savedQuery?: string) {
		if (savedQuery) saveRecentSearch(savedQuery);
		palette.close();
		void goto(href);
	}

	function choose(item: PaletteItem) {
		switch (item.kind) {
			case 'clear':
				clearRecentSearches();
				recents = [];
				inputEl?.focus();
				return;
			case 'retry':
				search.retry();
				inputEl?.focus();
				return;
			case 'search':
			case 'recent':
			case 'movie':
				go(item.href, item.query);
				return;
			default:
				go(item.href);
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<Dialog.Root bind:open={palette.isOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="kit-palette-overlay" bind:ref={overlayEl} />
		<Dialog.Content
			class="kit-palette"
			data-kit-palette=""
			trapFocus
			preventScroll
			bind:ref={contentEl}
			onOpenAutoFocus={focusInput}
			onCloseAutoFocus={() => releaseInert()}
		>
			<Dialog.Title class="sr-only" level={2}>Search</Dialog.Title>
			<Dialog.Description class="sr-only">
				Search films, or jump to a page. Use the arrow keys to move through the list and Enter to
				open the highlighted row.
			</Dialog.Description>

			<Command.Root
				shouldFilter={false}
				vimBindings={false}
				loop
				label="Search films and pages"
				class="kit-palette-root"
			>
				<div class="kit-palette-bar">
					<SearchIcon size={20} aria-hidden="true" />
					<Command.Input
						bind:value={query}
						bind:ref={inputEl}
						class="kit-palette-input"
						placeholder="Search films or pages"
						enterkeyhint="search"
						inputmode="search"
						autocapitalize="off"
						maxlength={120}
						onkeydown={onInputKeydown}
					/>
					<kbd class="kit-palette-esc" aria-hidden="true">Esc</kbd>
					<Dialog.Close class="kit-palette-close" aria-label="Close search">
						<XIcon size={20} aria-hidden="true" />
					</Dialog.Close>
				</div>

				{#if model.note}
					<div
						class="kit-palette-note"
						data-tone={model.note.tone}
						role={model.note.tone === 'error' ? 'alert' : undefined}
					>
						{model.note.text}
					</div>
				{/if}

				<!-- Keep the input focused when a row is pressed with a mouse. -->
				<Command.List
					class="kit-palette-list"
					aria-label="Results"
					tabindex={0}
					aria-busy={model.busy}
					onmousedown={(event: MouseEvent) => event.preventDefault()}
				>
					<Command.Viewport class="kit-palette-viewport">
						{#each model.top as item (item.value)}
							<PaletteRow {item} onselect={choose} />
						{/each}

						{#each model.groups as group (group.id)}
							{#if group.heading}
								<Command.Group value={group.id} class="kit-palette-group">
									<Command.GroupHeading class="kit-palette-heading">
										{group.heading}
									</Command.GroupHeading>
									<Command.GroupItems>
										{#each group.items as item (item.value)}
											<PaletteRow {item} onselect={choose} />
										{/each}
									</Command.GroupItems>
								</Command.Group>
							{:else}
								{#each group.items as item (item.value)}
									<PaletteRow {item} onselect={choose} />
								{/each}
							{/if}
						{/each}

						{#if model.placeholders > 0}
							<div class="kit-palette-skeletons" aria-hidden="true">
								{#each { length: model.placeholders }, index (index)}
									<div class="kit-palette-skeleton">
										<Skeleton width="2rem" height="3rem" borderRadius="var(--radius-xs)" />
										<div class="kit-palette-skeleton-lines">
											<Skeleton width={index % 2 ? '55%' : '70%'} height="0.95rem" />
											<Skeleton width="30%" height="0.75rem" />
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</Command.Viewport>
				</Command.List>
			</Command.Root>

			<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
				{model.announcement}
			</div>

			<div class="kit-palette-foot" aria-hidden="true">
				<span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
				<span><kbd>↵</kbd> Open</span>
				<span><kbd>Esc</kbd> Close</span>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.kit-palette-overlay) {
		position: fixed;
		inset: 0;
		z-index: var(--z-palette);
		background: var(--surface-scrim);
		animation: kit-palette-fade var(--duration-base) var(--ease-out) both;
	}
	:global(.kit-palette) {
		--kit-palette-top: calc(var(--safe-top) + var(--space-3));
		position: fixed;
		z-index: calc(var(--z-palette) + 1);
		top: calc(var(--kit-palette-top) + var(--kit-palette-offset, 0px));
		inset-inline: 0;
		display: flex;
		flex-direction: column;
		width: calc(100% - 2rem);
		max-width: 40rem;
		max-height: calc(
			var(--kit-palette-viewport, 100dvh) - var(--kit-palette-top) - var(--safe-bottom) -
				var(--space-3)
		);
		margin-inline: auto;
		overflow: hidden;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-xl);
		background: var(--surface-overlay);
		box-shadow: var(--elevation-3);
		color: var(--content-primary);
		outline: none;
		animation: kit-palette-in var(--duration-base) var(--ease-out) both;
	}
	/* Command.Root is the flex column that lets the list scroll inside the card. */
	:global(.kit-palette-root) {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		outline: none;
	}
	:global(.kit-palette-bar) {
		display: flex;
		flex: none;
		align-items: center;
		gap: var(--space-3);
		padding-inline: var(--space-4) var(--space-2);
		border-bottom: 1px solid var(--border-subtle);
		color: var(--content-secondary);
	}
	:global(.kit-palette-bar:focus-within) {
		border-bottom-color: var(--brand-primary);
		box-shadow: 0 1px 0 var(--brand-primary);
	}
	:global(.kit-palette-input) {
		flex: 1;
		min-width: 0;
		height: 3.5rem;
		border: 0;
		background: transparent;
		color: var(--content-primary);
		/* 16px or more: iOS Safari zooms into smaller fields on focus. */
		font-size: var(--type-body);
		outline: none;
	}
	:global(.kit-palette-input::placeholder) {
		color: var(--content-secondary);
	}
	:global(.kit-palette-input:focus-visible) {
		outline: none;
	}
	:global(.kit-palette-esc),
	:global(.kit-palette-foot kbd) {
		padding: 0.1rem 0.45rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-xs);
		background: var(--surface-interactive);
		color: var(--content-secondary);
		font-family: var(--font-mono);
		font-size: 0.7rem;
	}
	:global(.kit-palette-esc) {
		display: none;
	}
	:global(.kit-palette-close) {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: var(--touch-target);
		height: var(--touch-target);
		border-radius: 50%;
		color: var(--content-secondary);
	}
	:global(.kit-palette-close:hover) {
		background: rgba(255, 255, 255, 0.08);
		color: var(--content-primary);
	}
	:global(.kit-palette-note) {
		flex: none;
		padding: var(--space-3) var(--space-4) var(--space-1);
		color: var(--content-secondary);
		font-size: var(--text-sm);
	}
	:global(.kit-palette-note[data-tone='error']) {
		color: var(--color-error);
		font-weight: 600;
	}
	:global(.kit-palette-list) {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		scroll-padding-block: var(--space-2);
	}
	:global(.kit-palette-viewport) {
		padding-block: var(--space-2);
	}
	:global(.kit-palette-heading) {
		padding: var(--space-3) var(--space-4) var(--space-1);
		margin-inline: var(--space-2);
		color: var(--content-secondary);
		font-size: var(--type-label);
		font-weight: 700;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}
	:global(.kit-palette-skeleton) {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 4rem;
		margin-inline: var(--space-2);
		padding: var(--space-2) var(--space-3);
	}
	/* The kit skeleton is tuned for the canvas; on the overlay surface it needs a lighter shimmer. */
	:global(.kit-palette-skeletons .kit-palette-skeleton .skeleton) {
		background-image: linear-gradient(
			90deg,
			var(--surface-subtle) 25%,
			var(--surface-interactive) 50%,
			var(--surface-subtle) 75%
		);
		background-size: 200% 100%;
	}
	:global(.kit-palette-skeleton-lines) {
		display: grid;
		flex: 1;
		gap: var(--space-2);
	}
	:global(.kit-palette-foot) {
		display: none;
		flex: none;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		border-top: 1px solid var(--border-subtle);
		color: var(--content-secondary);
		font-size: var(--type-label);
	}
	:global(.kit-palette-foot span) {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	@keyframes kit-palette-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes kit-palette-in {
		from {
			opacity: 0;
			transform: translateY(-8px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (min-width: 640px) {
		:global(.kit-palette) {
			--kit-palette-top: max(calc(var(--safe-top) + var(--space-4)), 12dvh);
		}
		:global(.kit-palette-esc),
		:global(.kit-palette-foot) {
			display: inline-flex;
		}
		:global(.kit-palette-close) {
			display: none;
		}
		:global(.kit-palette-bar) {
			padding-inline-end: var(--space-4);
		}
	}
	/* Fade only: no movement for people who ask for less of it. */
	@media (prefers-reduced-motion: reduce) {
		:global(.kit-palette) {
			animation-name: kit-palette-fade;
		}
	}
	@media (forced-colors: active) {
		:global(.kit-palette) {
			border-color: CanvasText;
		}
		:global(.kit-palette-bar:focus-within) {
			outline: 2px solid Highlight;
			outline-offset: -2px;
		}
	}
</style>
