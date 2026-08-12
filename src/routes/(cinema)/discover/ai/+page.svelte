<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { enhance } from '$app/forms';

	let { data } = $props();

	type ChatMessage = {
		id: string;
		role: 'user' | 'ai';
		text: string;
		movies: Array<{
			id: string;
			title: string;
			posterPath: string | null;
			releaseDate: string | null;
			voteAverage: string | null;
		}>;
		loading?: boolean;
	};

	let messages = $state<ChatMessage[]>([]);
	let inputValue = $state('');
	let isLoading = $state(false);
	let chatContainer: HTMLDivElement;
	let inputEl: HTMLTextAreaElement;
	let turnCount = $state(0);

	const STARTER_PROMPTS = [
		"Trouve-moi un film sombre et psychologique que je n'ai pas encore vu",
		"Based on my taste, what should I watch on a rainy Sunday?",
		"Something with incredible cinematography, like 2001 or Blade Runner",
		"A hidden gem from the 90s I might have missed",
	];

	onMount(() => {
		inputEl?.focus();
	});

	async function scrollToBottom() {
		await tick();
		if (chatContainer) {
			chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
		}
	}

	async function sendMessage(text: string) {
		if (!text.trim() || isLoading) return;

		const userMsg: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			text: text.trim(),
			movies: []
		};

		const aiPlaceholder: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'ai',
			text: '',
			movies: [],
			loading: true
		};

		messages = [...messages, userMsg, aiPlaceholder];
		inputValue = '';
		isLoading = true;
		await scrollToBottom();

		try {
			const res = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text.trim() })
			});

			if (!res.ok) {
				const err = await res.text();
				throw new Error(err);
			}

			const data = await res.json();
			turnCount = data.turnCount;

			// Replace placeholder with real message
			messages = messages.map(m =>
				m.id === aiPlaceholder.id
					? { ...m, text: data.reply, movies: data.movies, loading: false }
					: m
			);
		} catch (e: any) {
			messages = messages.map(m =>
				m.id === aiPlaceholder.id
					? { ...m, text: `Error: ${e.message || 'Something went wrong'}`, movies: [], loading: false }
					: m
			);
		} finally {
			isLoading = false;
			await scrollToBottom();
			inputEl?.focus();
		}
	}

	async function resetChat() {
		messages = [];
		turnCount = 0;
		isLoading = false;
		inputValue = '';
		// Signal reset to backend
		await fetch('/api/ai/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: 'hello', reset: true })
		}).catch(() => {});
		// Consume the first reply silently by triggering a proper new session
		messages = [];
		inputEl?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage(inputValue);
		}
	}
</script>

<div class="chat-page">
	<!-- Header -->
	<div class="chat-header">
		<div class="header-left">
			<div class="ai-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1H1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2z"/><circle cx="7.5" cy="14.5" r="1.5"/><circle cx="16.5" cy="14.5" r="1.5"/></svg>
			</div>
			<div>
				<h1 class="chat-title">AI Curator</h1>
				<p class="chat-subtitle">
					{#if turnCount > 0}
						{turnCount} exchange{turnCount > 1 ? 's' : ''} · Knows your taste
					{:else}
						Knows your full watch history & ratings
					{/if}
				</p>
			</div>
		</div>
		{#if messages.length > 0}
			<button class="reset-btn" onclick={resetChat} title="New conversation">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
				New chat
			</button>
		{/if}
	</div>

	{#if data.missingApiKey}
		<div class="api-key-error">
			<p>Add your <code>GEMINI_API_KEY</code> to the environment variables to enable the AI.</p>
		</div>
	{:else}
		<!-- Chat thread -->
		<div class="chat-thread" bind:this={chatContainer}>
			{#if messages.length === 0}
				<!-- Empty state with starter prompts -->
				<div class="empty-state">
					<p class="empty-label">What are you in the mood for?</p>
					<div class="starter-prompts">
						{#each STARTER_PROMPTS as prompt}
							<button class="starter-chip" onclick={() => sendMessage(prompt)}>
								{prompt}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				{#each messages as msg (msg.id)}
					<div class="message-row {msg.role}">
						{#if msg.role === 'ai'}
							<div class="ai-avatar">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1H1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2z"/></svg>
							</div>
						{/if}
						<div class="bubble-wrap">
							<div class="bubble {msg.role}">
								{#if msg.loading}
									<div class="typing-indicator">
										<span></span><span></span><span></span>
									</div>
								{:else}
									<p class="bubble-text">{msg.text}</p>
								{/if}
							</div>
							{#if msg.movies && msg.movies.length > 0}
								<div class="movie-reel">
									{#each msg.movies as movie}
										<a href="/movies/{movie.id}" class="reel-card">
											<div class="reel-poster">
												{#if movie.posterPath}
													<img
														src="https://image.tmdb.org/t/p/w185{movie.posterPath}"
														alt={movie.title}
														loading="lazy"
													/>
												{:else}
													<div class="poster-fallback">?</div>
												{/if}
											</div>
											<div class="reel-info">
												<span class="reel-title">{movie.title}</span>
												<span class="reel-year">{movie.releaseDate?.substring(0, 4) ?? ''}</span>
												{#if movie.voteAverage}
													<span class="reel-rating">★ {Number(movie.voteAverage).toFixed(1)}</span>
												{/if}
											</div>
										</a>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Input bar -->
		<div class="input-bar">
			<div class="input-wrap">
				<textarea
					bind:this={inputEl}
					bind:value={inputValue}
					onkeydown={handleKeydown}
					placeholder="Ask for a recommendation, refine results, or just chat about film..."
					rows="1"
					disabled={isLoading}
					class="chat-input"
				></textarea>
				<button
					class="send-btn"
					onclick={() => sendMessage(inputValue)}
					disabled={isLoading || !inputValue.trim()}
					aria-label="Send"
				>
					{#if isLoading}
						<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
					{/if}
				</button>
			</div>
			<p class="input-hint">Enter to send · Shift+Enter for newline · Context is remembered in this session</p>
		</div>
	{/if}
</div>

<style>
	.chat-page {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 70px);
		max-width: 900px;
		margin: 0 auto;
		padding: 0 1rem;
	}

	/* Header */
	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 0 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		flex-shrink: 0;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.ai-icon {
		width: 40px;
		height: 40px;
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.2);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #10b981;
		flex-shrink: 0;
	}

	.chat-title {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.chat-subtitle {
		font-size: 0.78rem;
		color: var(--text-tertiary);
		margin: 0;
	}

	.reset-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.9rem;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: var(--text-secondary);
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.reset-btn:hover {
		border-color: rgba(255, 255, 255, 0.2);
		color: var(--text-primary);
	}

	/* Thread */
	.chat-thread {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem 0;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		scroll-behavior: smooth;
	}

	.chat-thread::-webkit-scrollbar { width: 4px; }
	.chat-thread::-webkit-scrollbar-track { background: transparent; }
	.chat-thread::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 1.5rem;
		padding: 3rem 0;
	}

	.empty-label {
		font-size: 1.1rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.starter-prompts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		justify-content: center;
		max-width: 600px;
	}

	.starter-chip {
		padding: 0.6rem 1.1rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 99px;
		color: var(--text-secondary);
		font-size: 0.85rem;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
	}

	.starter-chip:hover {
		background: rgba(245, 158, 11, 0.08);
		border-color: rgba(245, 158, 11, 0.25);
		color: var(--text-primary);
	}

	/* Messages */
	.message-row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.message-row.user {
		flex-direction: row-reverse;
	}

	.ai-avatar {
		width: 30px;
		height: 30px;
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.2);
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #10b981;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.bubble-wrap {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 80%;
	}

	.message-row.user .bubble-wrap {
		align-items: flex-end;
	}

	.bubble {
		padding: 0.85rem 1.1rem;
		border-radius: 14px;
		line-height: 1.6;
	}

	.bubble.user {
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.25);
		border-bottom-right-radius: 4px;
	}

	.bubble.ai {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-bottom-left-radius: 4px;
	}

	.bubble-text {
		color: var(--text-primary);
		font-size: 0.95rem;
		margin: 0;
		white-space: pre-wrap;
	}

	/* Typing indicator */
	.typing-indicator {
		display: flex;
		gap: 4px;
		align-items: center;
		padding: 0.25rem 0;
	}

	.typing-indicator span {
		width: 6px;
		height: 6px;
		background: var(--text-tertiary);
		border-radius: 50%;
		animation: bounce 1.2s infinite;
	}

	.typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
	.typing-indicator span:nth-child(3) { animation-delay: 0.3s; }

	@keyframes bounce {
		0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
		30% { transform: translateY(-5px); opacity: 1; }
	}

	/* Movie reel */
	.movie-reel {
		display: flex;
		gap: 0.75rem;
		overflow-x: auto;
		padding-bottom: 0.5rem;
	}

	.movie-reel::-webkit-scrollbar { height: 3px; }
	.movie-reel::-webkit-scrollbar-track { background: transparent; }
	.movie-reel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

	.reel-card {
		flex-shrink: 0;
		width: 110px;
		text-decoration: none;
		border-radius: 10px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.07);
		transition: transform 0.2s, border-color 0.2s;
	}

	.reel-card:hover {
		transform: translateY(-3px);
		border-color: rgba(16, 185, 129, 0.3);
	}

	.reel-poster {
		width: 100%;
		aspect-ratio: 2/3;
		overflow: hidden;
	}

	.reel-poster img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.poster-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255,255,255,0.05);
		color: var(--text-tertiary);
		font-size: 1.5rem;
	}

	.reel-info {
		padding: 0.5rem 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.reel-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.reel-year {
		font-size: 0.7rem;
		color: var(--text-tertiary);
	}

	.reel-rating {
		font-size: 0.7rem;
		color: #10b981;
		font-weight: 600;
	}

	/* Input bar */
	.input-bar {
		padding: 1rem 0 1.5rem;
		flex-shrink: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.input-wrap {
		display: flex;
		align-items: flex-end;
		gap: 0.6rem;
		background: rgba(15, 15, 15, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		padding: 0.75rem 0.75rem 0.75rem 1rem;
		transition: border-color 0.2s;
	}

	.input-wrap:focus-within {
		border-color: rgba(16, 185, 129, 0.4);
		box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.1);
	}

	.chat-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-primary);
		font-size: 0.95rem;
		font-family: inherit;
		resize: none;
		line-height: 1.5;
		max-height: 140px;
		overflow-y: auto;
	}

	.chat-input::placeholder {
		color: var(--text-tertiary);
	}

	.chat-input:disabled {
		opacity: 0.5;
	}

	.send-btn {
		width: 36px;
		height: 36px;
		background: #10b981;
		border: none;
		border-radius: 9px;
		color: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.2s, transform 0.1s;
	}

	.send-btn:hover:not(:disabled) {
		background: #34d399;
		transform: scale(1.05);
	}

	.send-btn:disabled {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-tertiary);
		cursor: not-allowed;
		transform: none;
	}

	.spin {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.input-hint {
		font-size: 0.72rem;
		color: var(--text-tertiary);
		text-align: center;
		margin: 0.5rem 0 0;
	}

	.api-key-error {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-secondary);
		text-align: center;
	}

	.api-key-error code {
		background: rgba(255,255,255,0.06);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-size: 0.85em;
		color: #f59e0b;
	}
</style>
