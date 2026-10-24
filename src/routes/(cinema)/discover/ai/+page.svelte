<script lang="ts">
	import { tick } from 'svelte';
	import MovieCard from '$lib/components/movie/MovieCard.svelte';

	let { data } = $props();

	type CuratorMovie = {
		id: string | number;
		title: string;
		posterPath: string | null;
		releaseDate?: string | null;
		voteAverage?: number | string | null;
	};

	type ChatTurn = {
		role: 'user' | 'curator';
		text: string;
		movies?: CuratorMovie[];
	};

	const SUGGESTIONS = [
		'Something like Heat, but less known',
		'A slow-burn sci-fi for a rainy evening',
		'Three films that would surprise me based on my ratings'
	];

	let turns = $state<ChatTurn[]>([]);
	let draft = $state('');
	let pending = $state(false);
	let errorMessage = $state<string | null>(null);
	let threadEl = $state<HTMLDivElement | null>(null);

	async function scrollToBottom() {
		await tick();
		threadEl?.scrollTo({ top: threadEl.scrollHeight, behavior: 'smooth' });
	}

	async function send(message: string, reset = false) {
		const text = message.trim();
		if (!text || pending) return;

		errorMessage = null;
		pending = true;
		turns = [...turns, { role: 'user', text }];
		draft = '';
		scrollToBottom();

		try {
			const res = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, reset })
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.message || `The curator is unavailable (HTTP ${res.status}).`);
			}

			const body = await res.json();
			turns = [...turns, { role: 'curator', text: body.reply, movies: body.movies ?? [] }];
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Something went wrong.';
		} finally {
			pending = false;
			scrollToBottom();
		}
	}

	function startOver() {
		turns = [];
		errorMessage = null;
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		// The first message after "start over" asks the server for a fresh session
		send(draft, turns.length === 0);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			send(draft, turns.length === 0);
		}
	}
</script>

<svelte:head>
	<title>AI Curator | CinemaDB</title>
</svelte:head>

<div class="container curator-page">
	<header class="curator-header">
		<div>
			<span class="eyebrow">AI Curator</span>
			<h1 class="curator-title">What should you watch next, {data.displayName}?</h1>
			<p class="curator-subtitle">
				Your curator already knows your ratings, favorites and reviews. Ask for a mood, a comparison
				or a deep cut.
			</p>
		</div>
		{#if turns.length > 0}
			<button type="button" class="btn-ghost" onclick={startOver} disabled={pending}>
				Start over
			</button>
		{/if}
	</header>

	<div class="thread" bind:this={threadEl} aria-live="polite">
		{#if turns.length === 0}
			<div class="empty-state">
				<p>Try one of these to get started:</p>
				<div class="suggestions">
					{#each SUGGESTIONS as suggestion}
						<button type="button" class="suggestion" onclick={() => send(suggestion, true)}>
							{suggestion}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#each turns as turn, i (i)}
			<div class="turn turn-{turn.role}">
				<span class="turn-author">{turn.role === 'user' ? 'You' : 'Curator'}</span>
				<p class="turn-text">{turn.text}</p>
				{#if turn.movies && turn.movies.length > 0}
					<div class="movie-row">
						{#each turn.movies as movie (movie.id)}
							<div class="movie-item">
								<MovieCard
									id={movie.id}
									title={movie.title}
									posterPath={movie.posterPath}
									releaseDate={movie.releaseDate}
									voteAverage={movie.voteAverage}
								/>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}

		{#if pending}
			<div class="turn turn-curator">
				<span class="turn-author">Curator</span>
				<p class="turn-text typing">Thinking…</p>
			</div>
		{/if}
	</div>

	{#if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}

	<form class="composer" onsubmit={handleSubmit}>
		<label for="curator-message" class="sr-only">Message the AI curator</label>
		<textarea
			id="curator-message"
			rows="2"
			maxlength="2000"
			placeholder="Ask for a recommendation…"
			bind:value={draft}
			onkeydown={handleKeydown}
			disabled={pending}></textarea>
		<button type="submit" class="btn-send" disabled={pending || !draft.trim()}>Send</button>
	</form>
</div>

<style>
	.curator-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding-top: 2.5rem;
		padding-bottom: 3rem;
		max-width: 960px;
	}

	.curator-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent-emerald);
	}

	.curator-title {
		margin: 0.4rem 0;
		font-size: clamp(1.5rem, 4vw, 2.2rem);
		color: var(--text-primary);
	}

	.curator-subtitle {
		color: var(--text-secondary);
		max-width: 60ch;
	}

	.thread {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 240px;
		max-height: 60vh;
		overflow-y: auto;
		padding: 1.25rem;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
	}

	.empty-state {
		color: var(--text-secondary);
	}

	.suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 0.75rem;
	}

	.suggestion {
		padding: 0.5rem 0.9rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--text-primary);
		font-size: 0.85rem;
		transition: border-color var(--transition-fast);
	}

	.suggestion:hover {
		border-color: var(--border-emerald);
	}

	.turn {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-width: 100%;
	}

	.turn-user {
		align-items: flex-end;
	}

	.turn-author {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.turn-text {
		margin: 0;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		line-height: 1.55;
		white-space: pre-wrap;
		color: var(--text-primary);
		background: var(--bg-surface-2);
		max-width: 75ch;
	}

	.turn-user .turn-text {
		background: var(--accent-emerald-subtle);
		border: 1px solid var(--border-emerald);
	}

	.typing {
		color: var(--text-secondary);
		font-style: italic;
	}

	.movie-row {
		display: flex;
		gap: 0.9rem;
		overflow-x: auto;
		padding: 0.25rem 0 0.5rem;
	}

	.movie-item {
		flex: 0 0 140px;
	}

	.error {
		color: var(--color-error);
		margin: 0;
	}

	.composer {
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;
	}

	.composer textarea {
		flex: 1;
		min-width: 0;
		resize: vertical;
		padding: 0.75rem 1rem;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font: inherit;
	}

	.composer textarea:focus {
		outline: none;
		border-color: var(--border-emerald);
	}

	.btn-send,
	.btn-ghost {
		padding: 0.75rem 1.4rem;
		border-radius: var(--radius-md);
		font-weight: 700;
		transition: filter var(--transition-fast);
	}

	.btn-send {
		background: var(--accent-emerald);
		color: #000;
	}

	.btn-send:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.btn-ghost {
		background: transparent;
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		white-space: nowrap;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
