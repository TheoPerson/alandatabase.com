<script lang="ts">
	// Dev harness (spec 13.5): /demo/hqp?state=…&kind=episode|movie&aspect=1.78|2.39|1.33
	// &mode=fit|fill&signal=direct|converted&sim=iphone18|iphone13|none&tick=0|1&outline=1&hint=1
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { HqpPlayer } from '$lib/components/hqp';
	import {
		createFakeEngine,
		DEMO_STATES,
		type DemoState
	} from '$lib/components/hqp/demo/fake-engine';
	import { DEMO_POSITION, demoLaunch } from '$lib/components/hqp/demo/fixtures';
	import type { HqpUiSeed } from '$lib/components/hqp/ui-state.svelte';

	const params = page.url.searchParams;
	const rawState = params.get('state') ?? 'controls';
	const state: DemoState = (DEMO_STATES as readonly string[]).includes(rawState)
		? (rawState as DemoState)
		: 'controls';
	const kind = params.get('kind') === 'movie' ? 'movie' : 'episode';
	const aspect = Number(params.get('aspect')) > 0 ? Number(params.get('aspect')) : 16 / 9;
	const mode = params.get('mode') === 'fill' ? 'fill' : 'fit';
	const signal = params.get('signal') === 'converted' ? 'converted' : 'direct';
	const sim =
		params.get('sim') === 'iphone13'
			? 'iphone13'
			: params.get('sim') === 'none'
				? 'none'
				: params.get('sim') === 'iphone18'
					? 'iphone18'
					: 'none';
	const tick = params.get('tick') !== '0';
	const outline = params.get('outline') === '1';
	// pin=0 lets the chrome auto-hide (interaction and performance checks).
	const pin = params.get('pin') !== '0';
	const homeHint = params.get('hint') === '1';

	const SEEDS: Record<DemoState, HqpUiSeed> = {
		controls: { pinChrome: true },
		hidden: { chrome: false },
		sheet: { pinChrome: true, overlay: 'sheet', sheetTab: 'tracks' },
		style: { pinChrome: true, overlay: 'sheet', sheetTab: 'tracks', sheetPage: 'style' },
		picture: { pinChrome: true, overlay: 'sheet', sheetTab: 'picture' },
		playback: { pinChrome: true, overlay: 'sheet', sheetTab: 'playback' },
		info: { pinChrome: true, info: true },
		scrub: {
			pinChrome: true,
			scrub: { source: 'timeline', origin: DEMO_POSITION, target: DEMO_POSITION + 892, rate: 1 }
		},
		seek: {
			chrome: false,
			ripple: { side: 'back', total: -20, key: 1 },
			peekAt: DEMO_POSITION - 20
		},
		hold: { chrome: false },
		upnext: { pinChrome: true },
		still: { pinChrome: true },
		end: { pinChrome: true },
		episodes: { pinChrome: true, overlay: 'episodes' },
		resume: { pinChrome: true },
		skip: { pinChrome: true },
		opening: { pinChrome: true },
		blocked: { pinChrome: true },
		buffering: { pinChrome: true },
		switching: { pinChrome: true },
		offline: { pinChrome: true },
		locked: { locked: true, lockPill: true, chrome: false },
		help: { pinChrome: true, overlay: 'help' },
		'error-503': { pinChrome: true },
		'error-409': { pinChrome: true },
		'error-decode': { pinChrome: true }
	};

	const launch = demoLaunch(kind, 0);
	// engine=real wires the production engine (createHqpEngine) against the real API, to check the
	// player end to end (without a signed-in owner it ends on the "session expired" card).
	const engine =
		params.get('engine') === 'real'
			? undefined
			: createFakeEngine(launch, { state, aspect, mode, signal, tick, homeHint });

	onMount(() => {
		const html = document.documentElement;
		if (sim !== 'none') html.dataset.hqpSim = sim;
		return () => {
			delete html.dataset.hqpSim;
		};
	});

	function close() {
		// The harness stays put and records the close for the interaction checks.
		document.documentElement.dataset.hqpClosed = String(Date.now());
	}
</script>

<svelte:head>
	<title>HQP harness · {state}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<HqpPlayer
	{launch}
	{engine}
	demoUi={{ ...SEEDS[state], pinChrome: pin && SEEDS[state].pinChrome }}
	onclose={close}
/>

{#if sim !== 'none'}
	<div class="sim" data-sim={sim} data-outline={outline ? '' : undefined} aria-hidden="true">
		<div class="corners"></div>
		<div class="island"></div>
		<div class="status">
			<span class="clock">21:41</span>
			<span class="right">5G <i class="battery"></i></span>
		</div>
		<div class="home"></div>
	</div>
{/if}

<style>
	/* Simulated iPhone hardware: drawn above the player, never interactive. */
	.sim {
		position: fixed;
		inset: 0;
		z-index: 100;
		pointer-events: none;
		font-family: -apple-system, 'SF Pro Text', var(--font-sans);
		color: var(--content-primary);
	}
	.corners {
		position: absolute;
		inset: 0;
		border-radius: 62px;
		box-shadow: 0 0 0 80px black;
	}
	.sim[data-sim='iphone13'] .corners {
		border-radius: 53px;
	}
	.island {
		position: absolute;
		background: black;
		border-radius: 999px;
	}
	.sim[data-outline] .island {
		outline: 1px solid var(--brand-primary);
	}
	.home {
		position: absolute;
		left: 0;
		right: 0;
		margin-inline: auto;
		bottom: 8px;
		width: 140px;
		height: 5px;
		border-radius: 3px;
		background: var(--content-primary);
		opacity: 0.55;
	}
	.status {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 54px;
		display: none;
		align-items: center;
		justify-content: space-between;
		padding: 4px 34px 0 52px;
		font-size: 17px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.right {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 15px;
	}
	.battery {
		position: relative;
		display: inline-block;
		width: 25px;
		height: 12px;
		border-radius: 4px;
		box-shadow: inset 0 0 0 1px var(--content-tertiary);
	}
	.battery::after {
		content: '';
		position: absolute;
		inset: 2px 6px 2px 2px;
		border-radius: 2px;
		background: var(--content-primary);
	}
	@media (orientation: portrait) {
		.status {
			display: flex;
		}
		.island {
			left: 0;
			right: 0;
			margin-inline: auto;
			top: 11px;
			width: 126px;
			height: 37px;
		}
		.sim[data-sim='iphone13'] .island {
			top: 0;
			width: 162px;
			height: 32px;
			border-radius: 0 0 20px 20px;
		}
	}
	@media (orientation: landscape) {
		.island {
			left: 11px;
			top: 0;
			bottom: 0;
			margin-block: auto;
			width: 37px;
			height: 126px;
		}
		.sim[data-sim='iphone13'] .island {
			left: 0;
			width: 32px;
			height: 162px;
			border-radius: 0 20px 20px 0;
		}
		.home {
			bottom: 6px;
		}
	}
</style>
