<script lang="ts">
	import { untrack } from 'svelte';
	import { getHqpContext } from '../context';
	import type { HqpSheetTab } from '../ui-state.svelte';
	import { rovingGroup } from './a11y';
	import Icon from './Icon.svelte';
	import Panel from './Panel.svelte';
	import TracksTab from './TracksTab.svelte';
	import StylePage from './StylePage.svelte';
	import PictureTab from './PictureTab.svelte';
	import PlaybackTab from './PlaybackTab.svelte';

	// The settings sheet (section 7.2): Audio & Subtitles | Picture | Playback, fixed height so
	// nothing jumps between tabs; tab bodies crossfade 120 ms.
	const { ui } = getHqpContext();
	const TABS: Array<{ id: HqpSheetTab; label: string; short?: string }> = [
		{ id: 'tracks', label: 'Audio & Subtitles', short: 'Audio & Subs' },
		{ id: 'picture', label: 'Picture' },
		{ id: 'playback', label: 'Playback' }
	];

	// The shell paints on the tap's next frame; the active tab body mounts right after that paint
	// and the two others one at a time when the main thread is idle, so no single task grows long on
	// a throttled CPU (the sheet is still sliding in). Mounted tabs stay mounted: switching is then
	// an attribute flip. Once warm (built ahead, see ui.warmSheet) the sheet stays mounted and parked
	// while closed, so opening it mounts nothing.
	const live = $derived(ui.shown === 'sheet' || ui.warmSheet);
	let mounted = $state<HqpSheetTab[]>([]);
	const isMounted = (tab: HqpSheetTab) => mounted.includes(tab);
	function mount(tab: HqpSheetTab) {
		if (!mounted.includes(tab)) mounted = [...mounted, tab];
	}
	$effect(() => {
		if (!live) {
			mounted = [];
			return;
		}
		// Safari has no requestIdleCallback: a short timer stands in.
		const hasIdle = typeof requestIdleCallback === 'function';
		let timer: ReturnType<typeof setTimeout> | undefined;
		let idleId: number | undefined;
		const idle = (fn: () => void) => {
			if (hasIdle) idleId = requestIdleCallback(fn, { timeout: 600 });
			else timer = setTimeout(fn, 200);
		};
		const rest = () => {
			const next = TABS.find((t) => !mounted.includes(t.id));
			if (!next) return;
			mount(next.id);
			idle(rest);
		};
		const raf = requestAnimationFrame(() => {
			timer = setTimeout(() => {
				mount(untrack(() => ui.sheetTab));
				idle(rest);
			});
		});
		return () => {
			cancelAnimationFrame(raf);
			clearTimeout(timer);
			if (idleId !== undefined) cancelIdleCallback(idleId);
		};
	});
	// A tab chosen before its idle turn mounts at once.
	$effect(() => {
		const tab = ui.sheetTab;
		if (ui.shown === 'sheet' && mounted.length > 0) untrack(() => mount(tab));
	});
	const ready = $derived(mounted.length > 0);
</script>

{#if live}
	<Panel
		parked={ui.shown !== 'sheet'}
		labelledby="hqp-sheet-title"
		initialFocus={ui.sheetPage === 'style' ? '.back' : '[role="tab"][aria-selected="true"]'}
	>
		{#snippet header()}
			<div class="head">
				{#if ui.sheetPage === 'style'}
					<button
						type="button"
						class="hqp-btn back"
						aria-label="Back to Audio and Subtitles"
						onclick={() => (ui.sheetPage = 'main')}
					>
						<Icon name="chevron-left" />
					</button>
					<h2 id="hqp-sheet-title" class="title">Subtitle style</h2>
				{:else}
					<h2 id="hqp-sheet-title" class="title">Settings</h2>
				{/if}
				<button
					type="button"
					class="hqp-btn close"
					aria-label="Close settings"
					onclick={() => ui.close()}
				>
					<Icon name="close" />
				</button>
			</div>
			{#if ui.sheetPage === 'main'}
				<div
					class="hqp-seg tabs"
					role="tablist"
					aria-label="Settings"
					use:rovingGroup={'[role="tab"]'}
				>
					{#each TABS as tab (tab.id)}
						<button
							type="button"
							role="tab"
							id="hqp-tab-{tab.id}"
							aria-selected={ui.sheetTab === tab.id}
							aria-controls="hqp-tabpanel-{tab.id}"
							tabindex={ui.sheetTab === tab.id ? 0 : -1}
							onclick={() => (ui.sheetTab = tab.id)}
						>
							{ui.portrait && tab.short ? tab.short : tab.label}
						</button>
					{/each}
				</div>
			{/if}
		{/snippet}
		<div class="tabpanel">
			<!-- All three tabs stay mounted once the sheet is open: switching is an attribute flip. -->
			{#if ready}
				{#if ui.sheetPage === 'style'}
					<div class="tab-body" role="group" aria-labelledby="hqp-sheet-title"><StylePage /></div>
				{/if}
				{#each TABS as tab (tab.id)}
					<div
						class="tab-body"
						role="tabpanel"
						id="hqp-tabpanel-{tab.id}"
						aria-labelledby="hqp-tab-{tab.id}"
						hidden={ui.sheetPage === 'style' || ui.sheetTab !== tab.id}
					>
						{#if isMounted(tab.id)}
							{#if tab.id === 'tracks'}
								<TracksTab />
							{:else if tab.id === 'picture'}
								<PictureTab />
							{:else}
								<PlaybackTab />
							{/if}
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</Panel>
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 10px 10px 4px 22px;
	}
	.head:has(.back) {
		gap: 8px;
		padding-left: 8px;
	}
	.title {
		flex: 1;
		margin: 0;
		font-size: 19px;
		line-height: 24px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.tabs {
		margin: 6px 16px 8px;
	}
	.tabs > :global(button) {
		height: 44px;
	}
	.tabpanel {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.tab-body[hidden] {
		display: none;
	}
	.tab-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		animation: hqp-tab-in var(--hqp-dur-fade) linear both;
	}
	@keyframes hqp-tab-in {
		from {
			opacity: 0;
		}
	}
	@media (max-width: 379px) {
		.tabs > :global(button) {
			font-size: 13px;
			padding: 0 4px;
		}
	}
</style>
