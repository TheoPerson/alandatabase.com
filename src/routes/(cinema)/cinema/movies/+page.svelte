<script lang="ts">
	import MoviesPage from '../../movies/+page.svelte';
	let { data } = $props();
</script>

<MoviesPage {data} />
