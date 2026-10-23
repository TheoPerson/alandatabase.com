<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { HqpPlayer } from '$lib/components/hqp';
	import type { HqpItem } from '$lib/player/hqp/types';

	let { data } = $props();

	// The item on screen: the requested one, then whatever the player moved to (next episode).
	let playing = $state<HqpItem | null>(null);
	const item = $derived(playing ?? data.launch.queue[data.launch.index]);

	// Close goes back when the player was opened from a page of the site, so the title page keeps
	// its scroll; a direct link, a reload or a Home Screen launch lands on the title page instead.
	let cameFromSite = false;
	afterNavigate(({ from }) => {
		cameFromSite = from !== null;
		playing = null;
	});

	function close() {
		if (cameFromSite) history.back();
		else goto(data.launch.returnHref, { replaceState: true });
	}

	function changed(next: HqpItem) {
		playing = next;
		replaceState(`/watch/${next.fileId}`, {});
	}

	// Black browser chrome around the picture while the player is open.
	onMount(() => {
		const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
		const previous = metas.map((meta) => meta.content);
		for (const meta of metas) meta.content = 'black';
		return () => metas.forEach((meta, index) => (meta.content = previous[index]));
	});
</script>

<svelte:head>
	<title>{item.title} · Alan's HQP</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<!-- A new load (another file opened in place) gets a fresh player and session. -->
{#key data.launch}
	<HqpPlayer launch={data.launch} startAt={data.startAt} onclose={close} onitemchange={changed} />
{/key}
