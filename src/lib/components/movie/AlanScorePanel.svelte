<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import SaveIcon from 'lucide-svelte/icons/save';
	import RotateCcwIcon from 'lucide-svelte/icons/rotate-ccw';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		ALAN_SCORE_DIMENSIONS,
		calculateAlanScore,
		EMPTY_ALAN_SCORE_VALUES,
		type AlanScoreDimension,
		type AlanScoreValues
	} from '$lib/alan-score';
	import type { AlanScoreView } from '$lib/server/services/alan-score.service';

	let {
		movieId,
		score = null,
		legacyRating = null,
		form = null
	}: {
		movieId: string;
		score?: AlanScoreView | null;
		legacyRating?: string | null;
		form?: Record<string, unknown> | null;
	} = $props();

	let values = $state<AlanScoreValues>({ ...EMPTY_ALAN_SCORE_VALUES });
	let enabled = $state<Record<AlanScoreDimension, boolean>>(
		Object.fromEntries(ALAN_SCORE_DIMENSIONS.map(({ key }) => [key, false])) as Record<
			AlanScoreDimension,
			boolean
		>
	);
	let note = $state('');
	let tags = $state('');
	let saving = $state(false);
	let resetting = $state(false);

	$effect(() => {
		const currentScore =
			form && Object.hasOwn(form, 'alanScore') ? (form.alanScore as AlanScoreView | null) : score;
		untrack(() => {
			values = { ...EMPTY_ALAN_SCORE_VALUES, ...(currentScore?.values ?? {}) };
			enabled = Object.fromEntries(
				ALAN_SCORE_DIMENSIONS.map(({ key }) => [
					key,
					currentScore?.values[key] !== null && currentScore !== null
				])
			) as Record<AlanScoreDimension, boolean>;
			for (const { key } of ALAN_SCORE_DIMENSIONS) {
				if (values[key] === null) values[key] = 5;
			}
			note = currentScore?.note ?? '';
			tags = currentScore?.tags.join(', ') ?? '';
		});
	});

	const preview = $derived.by(() => {
		const included = Object.fromEntries(
			ALAN_SCORE_DIMENSIONS.map(({ key }) => [key, enabled[key] ? values[key] : null])
		) as AlanScoreValues;
		return calculateAlanScore(included);
	});

	const missingLabels = $derived(
		preview.missing.map(
			(key) => ALAN_SCORE_DIMENSIONS.find((dimension) => dimension.key === key)?.label ?? key
		)
	);

	function toggleDimension(key: AlanScoreDimension, checked: boolean) {
		enabled[key] = checked;
	}
</script>

<section class="alan-score" aria-labelledby="alan-score-heading">
	<header class="score-header">
		<div>
			<p class="eyebrow">Personal</p>
			<h2 id="alan-score-heading">Alan Score</h2>
		</div>
		<div class="score-output" aria-live="polite">
			<strong>{preview.score === null ? 'Unrated' : `${preview.score.toFixed(1)}/10`}</strong>
			<span>{preview.coverage}% coverage</span>
		</div>
	</header>

	{#if preview.status === 'partial'}
		<p class="disclosure">Partial score based on {preview.coverage}% of the weighted dimensions.</p>
	{/if}
	{#if missingLabels.length > 0}
		<p class="missing"><span>Missing:</span> {missingLabels.join(', ')}</p>
	{/if}
	{#if legacyRating !== null}
		<p class="legacy">Legacy rating: <strong>{Number(legacyRating).toFixed(1)}/5</strong></p>
	{/if}

	<form
		method="POST"
		action="?/saveAlanScore"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update();
				saving = false;
			};
		}}
	>
		<input type="hidden" name="movieId" value={movieId} />
		<fieldset disabled={saving || resetting}>
			<legend class="sr-only">Weighted score dimensions</legend>
			<div class="dimensions">
				{#each ALAN_SCORE_DIMENSIONS as dimension (dimension.key)}
					<div class="dimension" class:included={enabled[dimension.key]}>
						<label class="include-control">
							<input
								type="checkbox"
								checked={enabled[dimension.key]}
								onchange={(event) => toggleDimension(dimension.key, event.currentTarget.checked)}
							/>
							<span>{dimension.label}</span>
							<small>{dimension.weight}%</small>
						</label>
						<div class="range-row">
							<input
								id={`alan-score-${dimension.key}`}
								aria-label={`${dimension.label} score`}
								type="range"
								name={dimension.key}
								min="0"
								max="10"
								step="0.5"
								disabled={!enabled[dimension.key]}
								bind:value={values[dimension.key]}
							/>
							<output for={`alan-score-${dimension.key}`}
								>{enabled[dimension.key] ? Number(values[dimension.key]).toFixed(1) : '—'}</output
							>
						</div>
					</div>
				{/each}
			</div>

			<div class="text-fields">
				<label>
					<span>Note</span>
					<textarea name="note" maxlength="2000" rows="3" bind:value={note}></textarea>
				</label>
				<label>
					<span>Tags</span>
					<input name="tags" value={tags} maxlength="329" placeholder="slow burn, theatrical" />
				</label>
			</div>
		</fieldset>

		<div class="form-footer">
			<div class="feedback" role="status" aria-live="polite">
				{#if form?.alanScoreError}<span class="error">{String(form.alanScoreError)}</span>{/if}
				{#if form?.alanScoreMessage}<span class="success">{String(form.alanScoreMessage)}</span
					>{/if}
			</div>
			<Button type="submit" variant="primary" disabled={saving || resetting}>
				<SaveIcon size={18} aria-hidden="true" />
				{saving ? 'Saving' : 'Save'}
			</Button>
		</div>
	</form>

	<form
		method="POST"
		action="?/resetAlanScore"
		class="reset-form"
		use:enhance={() => {
			resetting = true;
			return async ({ update }) => {
				await update();
				resetting = false;
			};
		}}
	>
		<input type="hidden" name="movieId" value={movieId} />
		<Button type="submit" variant="ghost" disabled={saving || resetting || !score}>
			<RotateCcwIcon size={18} aria-hidden="true" />
			{resetting ? 'Resetting' : 'Reset'}
		</Button>
	</form>
</section>

<style>
	.alan-score {
		margin: 0 0 2.5rem;
		padding: 1.25rem 0;
		border-block: 1px solid rgba(255, 255, 255, 0.16);
	}

	.score-header,
	.form-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.2rem;
		color: #a1a1aa;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	h2 {
		margin: 0;
		font-size: 1.35rem;
	}

	.score-output {
		display: grid;
		text-align: right;
	}

	.score-output strong {
		font-size: 1.25rem;
		color: #f8d66d;
	}

	.score-output span,
	.disclosure,
	.missing,
	.legacy {
		font-size: 0.82rem;
		color: #a1a1aa;
	}

	.disclosure,
	.missing,
	.legacy {
		margin: 0.75rem 0 0;
	}

	.missing span {
		color: #d4d4d8;
		font-weight: 600;
	}

	fieldset {
		margin: 1.25rem 0 0;
		padding: 0;
		border: 0;
	}

	.dimensions {
		display: grid;
		gap: 0.65rem;
	}

	.dimension {
		display: grid;
		grid-template-columns: minmax(13rem, 0.8fr) minmax(12rem, 1fr);
		align-items: center;
		gap: 1rem;
		min-height: 54px;
		padding: 0.45rem 0.65rem;
		border-left: 2px solid transparent;
		background: rgba(255, 255, 255, 0.035);
	}

	.dimension.included {
		border-color: #f8d66d;
	}

	.include-control {
		display: grid;
		grid-template-columns: 22px 1fr auto;
		align-items: center;
		gap: 0.6rem;
		min-height: 44px;
		cursor: pointer;
	}

	.include-control input {
		width: 18px;
		height: 18px;
		accent-color: #f8d66d;
	}

	.include-control span {
		font-size: 0.9rem;
		font-weight: 600;
	}

	.include-control small {
		color: #a1a1aa;
	}

	.range-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 3rem;
		align-items: center;
		gap: 0.75rem;
	}

	input[type='range'] {
		width: 100%;
		min-height: 44px;
		accent-color: #f8d66d;
	}

	output {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		text-align: right;
	}

	.text-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1rem;
	}

	.text-fields label {
		display: grid;
		gap: 0.4rem;
		font-size: 0.85rem;
		font-weight: 600;
	}

	textarea,
	.text-fields input {
		width: 100%;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 6px;
		background: #111;
		color: #fff;
		padding: 0.7rem;
		font: inherit;
	}

	.form-footer {
		margin-top: 1rem;
	}

	.feedback {
		min-height: 1.4rem;
		font-size: 0.84rem;
	}

	.error {
		color: #fca5a5;
	}

	.success {
		color: #86efac;
	}

	.reset-form {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.25rem;
	}

	:global(.alan-score button) {
		min-height: 44px;
		gap: 0.5rem;
	}

	@media (max-width: 640px) {
		.dimension,
		.text-fields {
			grid-template-columns: 1fr;
		}

		.dimension {
			gap: 0.1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.alan-score *,
		.alan-score *::before,
		.alan-score *::after {
			scroll-behavior: auto !important;
			transition-duration: 0.01ms !important;
			animation-duration: 0.01ms !important;
		}
	}
</style>
