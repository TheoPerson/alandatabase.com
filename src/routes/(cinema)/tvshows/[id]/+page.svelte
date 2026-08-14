<script lang="ts">
	import TVDetail from '../../tv/[id]/+page.svelte';
	let { data } = $props();
</script>

<TVDetail {data} />
