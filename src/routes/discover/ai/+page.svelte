<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	
	let isSubmitting = $state(false);
	let prompt = $state('');

	// Ensure we preserve previous responses if they just typed a new prompt
	// Svelte 5 $props() reactivity
</script>

<div class="container ai-page">
	<header class="page-header text-center mb-8">
		<div class="inline-block p-3 rounded-full bg-amber-500/10 text-amber-500 mb-4">
			<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
		</div>
		<h1 class="title">Alan's AI Curator</h1>
		<p class="subtitle max-w-2xl mx-auto">
			I analyze your watch history, reviews, and 5-star ratings to find the perfect film for your current mood.
		</p>
	</header>

	{#if data.missingApiKey}
		<div class="glass-panel p-6 border-red-500/30 text-center max-w-lg mx-auto">
			<h3 class="text-xl font-bold text-red-400 mb-2">API Key Required</h3>
			<p class="text-gray-300">Please add your <code class="bg-black/50 px-1 rounded text-amber-500">GEMINI_API_KEY</code> to the `.env` file to enable the AI features.</p>
		</div>
	{:else}
		<div class="search-container max-w-3xl mx-auto mb-12">
			<form
				method="POST"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update({ reset: false });
					};
				}}
				class="relative"
			>
				<textarea 
					name="prompt"
					bind:value={prompt}
					class="ai-input" 
					placeholder="e.g. 'I want a dark, mind-bending sci-fi movie like Blade Runner, but something I haven't seen yet...'"
					rows="3"
					required
				></textarea>
				
				<div class="absolute bottom-4 right-4">
					<Button type="submit" variant="primary" disabled={isSubmitting || prompt.trim() === ''}>
						{isSubmitting ? 'Thinking...' : 'Curate 🪄'}
					</Button>
				</div>
			</form>
			
			{#if form?.error}
				<div class="mt-4 p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
					{form.error}
				</div>
			{/if}
		</div>

		{#if form?.success && form?.aiResponse}
			<div class="results-container animate-fade-in">
				<div class="ai-response glass-panel mb-8 p-6 lg:p-8 relative overflow-hidden">
					<div class="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
					<p class="text-lg leading-relaxed text-gray-200">{form.aiResponse}</p>
				</div>

				<h3 class="text-2xl font-bold mb-6 text-amber-500">Curated For You</h3>
				
				<div class="movies-grid">
					{#each form.movies as movie}
						<a href="/movies/{movie.id}" class="movie-card glass-panel group">
							<div class="poster-wrapper">
								{#if movie.posterPath}
									<img src="https://image.tmdb.org/t/p/w342{movie.posterPath}" alt={movie.title} class="poster-img" />
								{:else}
									<div class="poster-placeholder">No Image</div>
								{/if}
								
								<div class="overlay">
									<span class="overlay-text">View Details</span>
								</div>
							</div>
							<div class="card-info">
								<h3 class="movie-title">{movie.title}</h3>
								<div class="flex justify-between items-center mt-1">
									<span class="movie-year">{movie.releaseDate ? movie.releaseDate.substring(0, 4) : 'N/A'}</span>
									{#if movie.voteAverage}
										<span class="movie-rating text-xs font-bold text-amber-500">★ {Number(movie.voteAverage).toFixed(1)}</span>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.ai-page {
		padding-top: 4rem;
		padding-bottom: 6rem;
	}

	.title {
		font-size: 3rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 1rem;
		background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.subtitle {
		font-size: 1.15rem;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.ai-input {
		width: 100%;
		background: rgba(15, 15, 15, 0.6);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		padding-bottom: 4.5rem;
		color: var(--text-primary);
		font-size: 1.15rem;
		font-family: inherit;
		resize: none;
		box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
		transition: all 0.3s ease;
	}

	.ai-input:focus {
		outline: none;
		border-color: rgba(245, 158, 11, 0.5);
		background: rgba(20, 20, 20, 0.8);
		box-shadow: 0 0 20px rgba(245, 158, 11, 0.15), inset 0 2px 10px rgba(0,0,0,0.5);
	}

	.movies-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1.5rem;
	}

	.movie-card {
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-md);
		overflow: hidden;
		transition: transform var(--transition-fast), border-color var(--transition-fast);
		text-decoration: none;
	}

	.movie-card:hover {
		transform: translateY(-5px);
		border-color: var(--border-accent);
	}

	.poster-wrapper {
		position: relative;
		aspect-ratio: 2 / 3;
		width: 100%;
		overflow: hidden;
	}

	.poster-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.5s ease;
	}

	.movie-card:hover .poster-img {
		transform: scale(1.05);
	}

	.poster-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-surface-2);
		color: var(--text-tertiary);
		font-size: 0.9rem;
	}

	.overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.movie-card:hover .overlay {
		opacity: 1;
	}

	.overlay-text {
		color: white;
		font-weight: 600;
		font-size: 0.95rem;
		padding: 0.5rem 1rem;
		border: 1px solid rgba(255,255,255,0.3);
		border-radius: 20px;
		backdrop-filter: blur(4px);
	}

	.card-info {
		padding: 1rem;
	}

	.movie-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.movie-year {
		color: var(--text-tertiary);
		font-size: 0.85rem;
	}

	.animate-fade-in {
		animation: fadeIn 0.5s ease-out forwards;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
