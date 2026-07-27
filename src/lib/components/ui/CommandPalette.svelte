<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade, scale } from 'svelte/transition';

	let open = $state(false);
	let query = $state('');

	const navigationLinks = [
		{ label: '🎬 Home', href: '/', category: 'Navigation' },
		{ label: '🍿 Cinema Catalog', href: '/movies', category: 'Navigation' },
		{ label: '🔍 Advanced Search', href: '/search', category: 'Navigation' },
		{ label: '📽️ My Personal Archive', href: '/my/films', category: 'Personal OS' },
		{ label: '🔑 Login', href: '/auth/login', category: 'Account' },
		{ label: '📝 Register', href: '/auth/register', category: 'Account' }
	];

	const filteredLinks = $derived(
		query.trim()
			? navigationLinks.filter((item) =>
					item.label.toLowerCase().includes(query.trim().toLowerCase())
			  )
			: navigationLinks
	);

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open = !open;
		} else if (e.key === 'Escape' && open) {
			open = false;
		}
	}

	function navigate(href: string) {
		open = false;
		query = '';
		goto(href);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="palette-backdrop"
		transition:fade={{ duration: 120 }}
		role="button"
		tabindex="0"
		onclick={() => (open = false)}
		onkeydown={(e) => e.key === 'Escape' && (open = false)}
	>
		<div
			class="palette-card"
			transition:scale={{ duration: 120, start: 0.96 }}
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-label="Command Palette"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="palette-header">
				<span class="search-icon">🔍</span>
				<input
					type="text"
					placeholder="Type a command or page name..."
					bind:value={query}
					class="palette-input"
				/>
				<span class="shortcut-badge">ESC</span>
			</div>

			<div class="palette-results">
				{#each filteredLinks as link}
					<button
						type="button"
						class="palette-item"
						onclick={() => navigate(link.href)}
					>
						<span class="item-label">{link.label}</span>
						<span class="item-category">{link.category}</span>
					</button>
				{/each}

				{#if filteredLinks.length === 0}
					<div class="empty-state">
						<p>No results found for "{query}"</p>
					</div>
				{/if}
			</div>

			<div class="palette-footer">
				<span>Press <kbd>Cmd+K</kbd> or <kbd>Ctrl+K</kbd> anytime</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.palette-backdrop {
		position: fixed;
		inset: 0;
		z-index: 300;
		background: rgba(7, 8, 11, 0.85);
		backdrop-filter: blur(12px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 15vh;
		padding-left: 1rem;
		padding-right: 1rem;
	}

	.palette-card {
		background: var(--bg-surface-1);
		border: 1px solid var(--border-accent);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 580px;
		box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8);
		overflow: hidden;
	}

	.palette-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.search-icon {
		font-size: 1.1rem;
		opacity: 0.7;
	}

	.palette-input {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-primary);
		font-size: 1.05rem;
		outline: none;
	}

	.shortcut-badge {
		font-size: 0.7rem;
		font-weight: 700;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		padding: 0.2rem 0.5rem;
		border-radius: var(--radius-sm);
		color: var(--text-tertiary);
	}

	.palette-results {
		max-height: 320px;
		overflow-y: auto;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.palette-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		width: 100%;
		text-align: left;
		transition: all var(--transition-fast);
	}

	.palette-item:hover {
		background: var(--bg-surface-2);
		color: var(--accent-gold);
	}

	.item-category {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
		color: var(--text-tertiary);
		font-size: 0.9rem;
	}

	.palette-footer {
		padding: 0.6rem 1.25rem;
		background: var(--bg-surface-2);
		border-top: 1px solid var(--border-subtle);
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	kbd {
		background: var(--bg-surface-3);
		padding: 0.15rem 0.35rem;
		border-radius: 3px;
		font-size: 0.7rem;
	}
</style>
