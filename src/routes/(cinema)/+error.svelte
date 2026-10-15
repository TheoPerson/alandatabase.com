<script lang="ts">
	import { page } from '$app/state';
	import ErrorPage from '$lib/components/ui/error-page';
</script>

<ErrorPage status={page.status} message={page.error?.message} />
