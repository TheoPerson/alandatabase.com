<script lang="ts">
	import MovieDetail from '../../../movies/[id]/+page.svelte';
	let { data, form } = $props();
</script>

<MovieDetail {data} {form} />
