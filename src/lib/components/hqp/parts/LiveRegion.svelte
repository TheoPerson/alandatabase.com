<script lang="ts">
	import { getHqpContext } from '../context';

	// One polite live region (section 11): seeks, track and quality changes, resume, up next, sleep.
	// The engine's announcements and the UI's share it; the most recent one wins.
	const { snapshot, ui } = getHqpContext();
	let text = $state('');
	// Derived first: the effect re-runs only when the announcement object itself changes.
	const engineAnnouncement = $derived($snapshot.announcement);
	$effect(() => {
		const next = engineAnnouncement;
		if (next) text = next.text;
	});
	$effect(() => {
		const next = ui.announcement;
		if (next) text = next.text;
	});
</script>

<div class="hqp-sr" aria-live="polite" aria-atomic="true">{text}</div>
