<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SvelteMap } from 'svelte/reactivity';
	import {
		AlertTriangle,
		Bell,
		BellOff,
		Download,
		Grid3X3,
		List,
		RefreshCw,
		Search
	} from 'lucide-svelte';
	import MoviePoster from '$lib/components/movie/MoviePoster.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ErrorState from '$lib/components/ui/ErrorState.svelte';
	import { addToast } from '$lib/stores/toast';
	import { RELEASE_TYPE_LABELS } from '$lib/release-calendar';
	import type { CalendarItem } from '$lib/server/services/release-calendar.service';

	let { data, form } = $props();
	let syncing = $state(false);
	let syncProgress = $state('');

	const dateFormatter = new Intl.DateTimeFormat(undefined, {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
	const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

	function localDate(value: string): Date {
		return new Date(`${value}T12:00:00`);
	}

	function formatDate(value: string | null): string {
		return value ? dateFormatter.format(localDate(value)) : 'Date unknown';
	}

	const monthSections = $derived.by(() => {
		const sections = new SvelteMap<
			string,
			{
				label: string;
				leading: number[];
				days: Array<{ date: string; day: number; items: CalendarItem[] }>;
			}
		>();
		for (const item of data.items) {
			if (!item.date) continue;
			const date = localDate(item.date);
			const key = item.date.slice(0, 7);
			let section = sections.get(key);
			if (!section) {
				const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
				const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12).getDate();
				section = {
					label: monthFormatter.format(first),
					leading: Array.from({ length: (first.getDay() + 6) % 7 }, (_, index) => index),
					days: Array.from({ length: daysInMonth }, (_, index) => {
						const day = index + 1;
						const fullDate = `${key}-${String(day).padStart(2, '0')}`;
						return { date: fullDate, day, items: [] as CalendarItem[] };
					})
				};
				sections.set(key, section);
			}
			section.days[date.getDate() - 1]?.items.push(item);
		}
		return [...sections.entries()].map(([key, value]) => ({ key, ...value }));
	});

	async function synchronizeCalendar() {
		syncing = true;
		syncProgress = 'Discovering popular upcoming releases...';
		let payload: { runId?: string; cursor?: string } = {};
		try {
			for (let batch = 0; batch < 5; batch += 1) {
				const response = await fetch('/api/admin/calendar/sync', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const result = await response.json();
				if (!response.ok) throw new Error(result.error || 'Calendar synchronization failed.');
				syncProgress = `${Math.min((batch + 1) * 20, result.processed + batch * 20)} films processed in this run.`;
				if (result.complete) {
					addToast(
						result.failed > 0
							? `Calendar sync completed with ${result.failed} failed film${result.failed === 1 ? '' : 's'}.`
							: 'Release calendar synchronized.',
						result.failed > 0 ? 'info' : 'success'
					);
					break;
				}
				payload = { runId: result.runId, cursor: result.nextCursor };
			}
			await invalidateAll();
		} catch (error) {
			addToast(
				error instanceof Error ? error.message : 'Calendar synchronization failed.',
				'error'
			);
			syncProgress = 'Synchronization paused. The completed batches remain saved.';
		} finally {
			syncing = false;
		}
	}
</script>

<svelte:head>
	<title>Global Release Calendar | Alan Database</title>
	<meta
		name="description"
		content="Browse a personal calendar of popular upcoming global film releases and regional provider availability."
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="calendar-page container">
	<header class="page-header">
		<div>
			<p class="eyebrow">Popular upcoming releases</p>
			<h1>Global release calendar</h1>
			<p class="lede">
				A rolling view of globally popular films, with release details and current provider
				availability for {data.query.countryCode}.
			</p>
		</div>
		{#if data.isOwner}
			<button class="sync-button" type="button" onclick={synchronizeCalendar} disabled={syncing}>
				<span class:spin={syncing}><RefreshCw size={18} aria-hidden="true" /></span>
				<span>{syncing ? 'Syncing' : 'Sync calendar'}</span>
			</button>
		{/if}
	</header>

	{#if syncProgress}
		<p class="sync-progress" role="status" aria-live="polite">{syncProgress}</p>
	{/if}
	{#if form?.message || form?.error}
		<p class:form-error={form?.error} class="form-status" role="status" aria-live="polite">
			{form.message || form.error}
		</p>
	{/if}

	{#if data.latestSync && data.latestSync.status !== 'complete'}
		<div class="notice warning" role="status">
			<AlertTriangle size={18} aria-hidden="true" />
			<span>
				Partial sync: {data.latestSync.processed} of {data.latestSync.total} films processed
				{data.latestSync.failed ? `, ${data.latestSync.failed} failed` : ''}.
			</span>
		</div>
	{:else if data.stale}
		<div class="notice" role="status">
			<AlertTriangle size={18} aria-hidden="true" />
			<span>Calendar data is more than 24 hours old. Provider availability may have changed.</span>
		</div>
	{/if}

	<form class="filter-band" method="GET" aria-label="Calendar filters">
		<label class="search-control">
			<span>Search</span>
			<div class="input-with-icon">
				<Search size={17} aria-hidden="true" />
				<input name="q" type="search" value={data.query.search} placeholder="Film title" />
			</div>
		</label>
		<label>
			<span>Genre</span>
			<select name="genre" value={data.query.genreId ?? ''}>
				<option value="">All genres</option>
				{#each data.genres as genre}
					<option value={genre.id}>{genre.name}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Release type</span>
			<select name="type" value={data.query.releaseType ?? ''}>
				<option value="">All types</option>
				{#each Object.entries(RELEASE_TYPE_LABELS) as [value, label]}
					<option {value}>{label}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Region</span>
			<input name="region" value={data.query.countryCode} maxlength="2" pattern="[A-Za-z]{2}" />
		</label>
		<label>
			<span>Alan Score</span>
			<select name="score" value={data.query.alanScore}>
				<option value="any">Any score</option>
				<option value="complete">Complete</option>
				<option value="partial">Partial</option>
				<option value="unrated">Unrated</option>
			</select>
		</label>

		<fieldset class="range-control">
			<legend>Range</legend>
			<div class="segments">
				{#each [7, 30, 90] as range}
					<label>
						<input type="radio" name="range" value={range} checked={data.query.range === range} />
						<span>{range} days</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset class="view-control">
			<legend>View</legend>
			<div class="segments icon-segments">
				<label title="Agenda view">
					<input type="radio" name="view" value="agenda" checked={data.query.view === 'agenda'} />
					<span><List size={18} aria-hidden="true" /> Agenda</span>
				</label>
				<label title="Month view">
					<input type="radio" name="view" value="month" checked={data.query.view === 'month'} />
					<span><Grid3X3 size={18} aria-hidden="true" /> Month</span>
				</label>
			</div>
		</fieldset>

		<div class="binary-filters">
			<label
				><input type="checkbox" name="watchlist" value="1" checked={data.query.watchlist} /> Watchlist</label
			>
			<label
				><input type="checkbox" name="watched" value="1" checked={data.query.watched} /> Watched</label
			>
			<label
				><input type="checkbox" name="tracked" value="1" checked={data.query.tracked} /> Tracked</label
			>
		</div>
		<button class="apply-button" type="submit">Apply filters</button>
	</form>

	<details class="preferences">
		<summary>Calendar preferences</summary>
		<form method="POST" action="?/savePreferences" class="preference-form">
			<label>
				<span>Provider country</span>
				<input
					name="countryCode"
					value={data.preferences.countryCode}
					maxlength="2"
					pattern="[A-Za-z]{2}"
					required
				/>
			</label>
			<label>
				<span>Reminder timezone</span>
				<input name="timezone" value={data.preferences.timezone} maxlength="64" required />
			</label>
			<button type="submit">Save preferences</button>
		</form>
	</details>

	{#if data.error}
		<ErrorState title="Calendar unavailable" description={data.error} />
	{:else if data.items.length === 0}
		<EmptyState
			title="No releases match these filters"
			description={data.latestSync
				? 'Adjust the date range or filters, or continue an incomplete synchronization.'
				: 'The owner can run the first manual synchronization to populate the rolling calendar.'}
		/>
	{:else if data.query.view === 'month'}
		<div class="month-stack">
			{#each monthSections as month (month.key)}
				<section class="month-section" aria-labelledby="month-{month.key}">
					<h2 id="month-{month.key}">{month.label}</h2>
					<div class="weekday-row" aria-hidden="true">
						{#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as weekday}<span
								>{weekday}</span
							>{/each}
					</div>
					<div class="month-grid">
						{#each month.leading as blank}<div
								class="blank-day"
								aria-hidden="true"
								data-index={blank}
							></div>{/each}
						{#each month.days as day (day.date)}
							<div class:has-releases={day.items.length > 0} class="month-day">
								<span class="day-number">{day.day}</span>
								<div class="day-items">
									{#each day.items.slice(0, 3) as item (item.eventId)}
										<a href="/movies/{item.movieId}" title={item.title}>{item.title}</a>
									{/each}
									{#if day.items.length > 3}<span class="more">+{day.items.length - 3} more</span
										>{/if}
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{:else}
		<div class="agenda" aria-label="Release agenda">
			{#each data.items as item (item.eventId)}
				<article class="release-row">
					<a href="/movies/{item.movieId}" class="poster-link" aria-label={`Open ${item.title}`}>
						<MoviePoster path={item.posterPath} title={item.title} size="w185" />
					</a>
					<div class="release-main">
						<div class="release-heading">
							<div>
								<p class="release-date">{formatDate(item.date)}</p>
								<h2><a href="/movies/{item.movieId}">{item.title}</a></h2>
							</div>
							<span class="type-badge">{RELEASE_TYPE_LABELS[item.releaseType]}</span>
						</div>
						<p class="meta-line">
							{item.countryCode === 'GLOBAL'
								? 'Global primary date'
								: `${item.countryCode} regional date`}
							{#if item.genres.length}
								· {item.genres.map((genre) => genre.name).join(', ')}{/if}
						</p>
						<div class="personal-state">
							<span class:active={item.watchlist}>Watchlist</span>
							<span class:active={item.watched}>Watched</span>
							<span class:active={item.tracked}>Tracked</span>
							<span class:active={item.alanScore !== null}>
								Alan Score {item.alanScore === null ? 'unrated' : item.alanScore.toFixed(1)}
							</span>
						</div>
						<div class="providers">
							<strong>Available in {data.query.countryCode}</strong>
							{#if item.providers.length}
								<div class="provider-list">
									{#each item.providers as provider (provider.id)}
										<span title={provider.monetizationTypes.join(', ')}>{provider.name}</span>
									{/each}
								</div>
								{#if item.providerLink}
									<a href={item.providerLink} target="_blank" rel="noopener">View availability</a>
								{/if}
							{:else}
								<span class="muted">No current provider snapshot for this region.</span>
							{/if}
							{#if item.providersStale}<span class="stale">Snapshot may be stale</span>{/if}
						</div>
					</div>

					<div class="reminder-tools">
						{#if item.date}
							<form method="POST" action="?/createReminder" class="reminder-form">
								<input type="hidden" name="eventId" value={item.eventId} />
								<label>
									<span class="sr-only">Reminder timing for {item.title}</span>
									<select name="offsetDays" aria-label={`Reminder timing for ${item.title}`}>
										<option value="0">Release day</option>
										<option value="1">One day before</option>
										<option value="7">Seven days before</option>
									</select>
								</label>
								<button type="submit" title="Save reminder"
									><Bell size={17} aria-hidden="true" /> Save</button
								>
							</form>
						{:else}
							<span class="muted">A reminder needs a known date.</span>
						{/if}
						{#each item.reminders as reminder (reminder.id)}
							<div class:due={reminder.due} class="saved-reminder">
								<span
									>{reminder.offsetDays === 0
										? 'Release day'
										: `${reminder.offsetDays} day${reminder.offsetDays === 1 ? '' : 's'} before`}</span
								>
								<a
									href="/movies/calendar/reminders/{reminder.id}.ics"
									title="Download calendar event"
									aria-label={`Download ${item.title} reminder`}
								>
									<Download size={17} aria-hidden="true" />
								</a>
								<form method="POST" action="?/deleteReminder">
									<input type="hidden" name="reminderId" value={reminder.id} />
									<button
										type="submit"
										title="Remove reminder"
										aria-label={`Remove ${item.title} reminder`}
									>
										<BellOff size={17} aria-hidden="true" />
									</button>
								</form>
							</div>
						{/each}
					</div>
				</article>
			{/each}
		</div>
	{/if}

	<p class="provider-attribution">
		Provider availability is a current regional snapshot supplied by <strong>JustWatch</strong> through
		TMDB. It is not a release date or cinema showtime.
	</p>
</div>

<style>
	.calendar-page {
		padding-block: clamp(2rem, 5vw, 4rem);
		min-width: 0;
	}
	.page-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}
	.eyebrow {
		color: var(--brand-primary);
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.25rem 0 0.45rem;
		font-size: clamp(2rem, 5vw, 3.75rem);
		line-height: 1.05;
	}
	.lede {
		max-width: 48rem;
		color: var(--content-secondary);
	}
	.sync-button,
	.apply-button,
	.preference-form button,
	.reminder-form button {
		display: inline-flex;
		min-height: var(--touch-target);
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border-radius: var(--radius-sm);
		background: var(--brand-primary);
		color: var(--content-inverse);
		padding: 0.65rem 1rem;
		font-weight: 800;
	}
	.sync-button:disabled {
		opacity: 0.55;
	}
	.spin {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.sync-progress,
	.form-status {
		margin-bottom: 1rem;
		color: var(--content-secondary);
	}
	.form-error {
		color: var(--color-error);
	}
	.notice {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 1rem;
		padding: 0.75rem 1rem;
		border-left: 3px solid var(--color-info);
		background: rgba(96, 165, 250, 0.08);
	}
	.notice.warning {
		border-color: var(--color-warning);
		background: rgba(251, 191, 36, 0.08);
	}
	.filter-band {
		display: grid;
		grid-template-columns: repeat(5, minmax(8rem, 1fr));
		gap: 0.85rem;
		padding-block: 1.25rem;
		border-block: 1px solid var(--border-subtle);
	}
	.filter-band label,
	.preference-form label {
		display: grid;
		gap: 0.3rem;
		min-width: 0;
		color: var(--content-secondary);
		font-size: 0.78rem;
		font-weight: 700;
	}
	input,
	select {
		width: 100%;
		min-height: var(--touch-target);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--content-primary);
		padding: 0.55rem 0.7rem;
	}
	.input-with-icon {
		position: relative;
	}
	.input-with-icon :global(svg) {
		position: absolute;
		left: 0.7rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--content-tertiary);
	}
	.input-with-icon input {
		padding-left: 2.25rem;
	}
	fieldset {
		border: 0;
		min-width: 0;
	}
	legend {
		margin-bottom: 0.3rem;
		color: var(--content-secondary);
		font-size: 0.78rem;
		font-weight: 700;
	}
	.segments {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		min-height: var(--touch-target);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.segments label {
		display: block;
	}
	.segments input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}
	.segments span {
		display: flex;
		height: 100%;
		min-height: var(--touch-target);
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.4rem;
		background: var(--surface-raised);
		color: var(--content-secondary);
		font-size: 0.78rem;
	}
	.segments input:checked + span {
		background: var(--brand-muted);
		color: var(--brand-primary);
	}
	.segments input:focus-visible + span {
		outline: 2px solid var(--brand-primary);
		outline-offset: -2px;
	}
	.icon-segments {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.binary-filters {
		grid-column: span 3;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.binary-filters label {
		display: flex;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.45rem;
	}
	.binary-filters input {
		width: 1.1rem;
		min-height: 1.1rem;
		accent-color: var(--brand-primary);
	}
	.apply-button {
		align-self: end;
	}
	.preferences {
		margin: 1rem 0 1.5rem;
		color: var(--content-secondary);
	}
	.preferences summary {
		min-height: var(--touch-target);
		display: flex;
		align-items: center;
		cursor: pointer;
		font-weight: 700;
	}
	.preference-form {
		display: grid;
		grid-template-columns: 10rem minmax(15rem, 1fr) auto;
		align-items: end;
		gap: 0.75rem;
		max-width: 48rem;
		padding: 0.75rem 0;
	}
	.agenda {
		display: grid;
		gap: 1px;
		background: var(--border-subtle);
		border-block: 1px solid var(--border-subtle);
	}
	.release-row {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr) minmax(13rem, 18rem);
		gap: 1.25rem;
		padding: 1.25rem 0;
		background: var(--surface-canvas);
	}
	.poster-link {
		width: 7rem;
	}
	.release-main {
		min-width: 0;
	}
	.release-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}
	.release-heading h2 {
		margin: 0.1rem 0;
		font-size: 1.25rem;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}
	.release-heading a:hover {
		color: var(--brand-primary);
	}
	.release-date {
		color: var(--brand-primary);
		font-size: 0.82rem;
		font-weight: 800;
	}
	.type-badge {
		flex: none;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-xs);
		color: var(--content-secondary);
		font-size: 0.72rem;
	}
	.meta-line,
	.muted {
		color: var(--content-tertiary);
		font-size: 0.8rem;
	}
	.personal-state {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.75rem;
	}
	.personal-state span {
		padding: 0.22rem 0.45rem;
		border-radius: var(--radius-xs);
		background: var(--surface-raised);
		color: var(--content-tertiary);
		font-size: 0.72rem;
	}
	.personal-state .active {
		background: var(--brand-muted);
		color: var(--brand-primary);
	}
	.providers {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.85rem;
		font-size: 0.78rem;
	}
	.provider-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.provider-list span {
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs);
	}
	.providers a {
		width: fit-content;
		color: var(--brand-primary);
		text-decoration: underline;
	}
	.stale {
		color: var(--color-warning);
	}
	.reminder-tools {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.6rem;
	}
	.reminder-form {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.45rem;
	}
	.reminder-form button {
		padding-inline: 0.7rem;
	}
	.saved-reminder {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--touch-target) var(--touch-target);
		align-items: center;
		min-height: var(--touch-target);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		color: var(--content-secondary);
		font-size: 0.75rem;
	}
	.saved-reminder > span {
		padding-left: 0.65rem;
	}
	.saved-reminder a,
	.saved-reminder button {
		display: grid;
		width: var(--touch-target);
		height: var(--touch-target);
		place-items: center;
		color: var(--content-secondary);
	}
	.saved-reminder.due {
		border-color: var(--brand-border);
		color: var(--brand-primary);
	}
	.month-stack {
		display: grid;
		gap: 2.5rem;
	}
	.month-section h2 {
		margin-bottom: 0.8rem;
		font-size: 1.4rem;
	}
	.weekday-row,
	.month-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}
	.weekday-row span {
		padding: 0.45rem;
		color: var(--content-tertiary);
		font-size: 0.72rem;
		text-align: center;
	}
	.month-day,
	.blank-day {
		min-height: 7.5rem;
		border: 1px solid var(--border-subtle);
		padding: 0.45rem;
		overflow: hidden;
	}
	.blank-day {
		background: var(--surface-subtle);
		opacity: 0.45;
	}
	.month-day.has-releases {
		background: var(--surface-raised);
	}
	.day-number {
		color: var(--content-tertiary);
		font-size: 0.75rem;
	}
	.day-items {
		display: grid;
		gap: 0.3rem;
		margin-top: 0.4rem;
	}
	.day-items a {
		overflow: hidden;
		color: var(--content-secondary);
		font-size: 0.7rem;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.day-items a:hover {
		color: var(--brand-primary);
	}
	.more {
		color: var(--content-tertiary);
		font-size: 0.65rem;
	}
	.provider-attribution {
		margin-top: 1.5rem;
		color: var(--content-tertiary);
		font-size: 0.75rem;
	}
	@media (max-width: 1024px) {
		.filter-band {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.release-row {
			grid-template-columns: 6rem minmax(0, 1fr);
		}
		.poster-link {
			width: 6rem;
		}
		.reminder-tools {
			grid-column: 2;
			flex-direction: row;
			flex-wrap: wrap;
		}
		.reminder-form {
			min-width: 18rem;
		}
	}
	@media (max-width: 680px) {
		.page-header {
			align-items: stretch;
			flex-direction: column;
		}
		.sync-button {
			width: 100%;
		}
		.filter-band {
			grid-template-columns: 1fr 1fr;
		}
		.search-control,
		.range-control,
		.view-control,
		.binary-filters {
			grid-column: 1 / -1;
		}
		.binary-filters {
			justify-content: space-between;
		}
		.preference-form {
			grid-template-columns: 1fr;
		}
		.release-row {
			grid-template-columns: 4.75rem minmax(0, 1fr);
			gap: 0.8rem;
		}
		.poster-link {
			width: 4.75rem;
		}
		.release-heading {
			display: block;
		}
		.type-badge {
			display: inline-block;
			margin-top: 0.25rem;
		}
		.reminder-tools {
			grid-column: 1 / -1;
		}
		.reminder-form {
			min-width: 0;
			width: 100%;
		}
		.month-stack {
			overflow-x: auto;
		}
		.month-section {
			min-width: 42rem;
		}
	}
	@media (max-width: 380px) {
		.filter-band {
			grid-template-columns: 1fr;
		}
		.filter-band > * {
			grid-column: 1;
		}
		.release-row {
			grid-template-columns: 4rem minmax(0, 1fr);
		}
		.poster-link {
			width: 4rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation: none;
		}
	}
</style>
