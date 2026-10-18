<!-- The second half of the HQP sprite: glyphs only the lazily loaded panels, cards and the desktop
bar use (see Icons.svelte). Rendered once with them. -->
<svg class="hqp-sprite" aria-hidden="true" focusable="false">
	<symbol id="hqp-i-chevron-right" viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6" /></symbol>
	<symbol id="hqp-i-chevron-left" viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6" /></symbol>
	<symbol id="hqp-i-unlock" viewBox="0 0 24 24"
		><rect x="5" y="10.5" width="14" height="10" rx="2.6" /><path
			d="M8.5 10.5V7.6a3.5 3.5 0 0 1 6.7-1.4"
		/></symbol
	>
	<symbol id="hqp-i-audio" viewBox="0 0 24 24"
		><path d="M4 10v4M8 7v10M12 4.5v15M16 8v8M20 10.5v3" /></symbol
	>
	<symbol id="hqp-i-volume" viewBox="0 0 24 24"
		><path d="M4 9.6h3.2l4.6-4v12.8l-4.6-4H4z" /><path
			d="M15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8"
		/></symbol
	>
	<symbol id="hqp-i-volume-mute" viewBox="0 0 24 24"
		><path d="M4 9.6h3.2l4.6-4v12.8l-4.6-4H4z" /><path
			d="M16 9.6l4.8 4.8M20.8 9.6L16 14.4"
		/></symbol
	>
	<symbol id="hqp-i-fullscreen" viewBox="0 0 24 24"
		><path
			d="M4 9V5.6A1.6 1.6 0 0 1 5.6 4H9M15 4h3.4A1.6 1.6 0 0 1 20 5.6V9M20 15v3.4a1.6 1.6 0 0 1-1.6 1.6H15M9 20H5.6A1.6 1.6 0 0 1 4 18.4V15"
		/></symbol
	>
	<symbol id="hqp-i-fullscreen-exit" viewBox="0 0 24 24"
		><path
			d="M9 4v3.4A1.6 1.6 0 0 1 7.4 9H4M20 9h-3.4A1.6 1.6 0 0 1 15 7.4V4M15 20v-3.4a1.6 1.6 0 0 1 1.6-1.6H20M4 15h3.4A1.6 1.6 0 0 1 9 16.6V20"
		/></symbol
	>
	<symbol id="hqp-i-check" viewBox="0 0 24 24"><path d="M5 12.6l4.4 4.4L19 7.4" /></symbol>
	<symbol id="hqp-i-quality" viewBox="0 0 24 24"
		><path d="M11 3.5l1.9 5.2 5.1 1.9-5.1 1.9L11 17.7l-1.9-5.2L4 10.6l5.1-1.9z" /><path
			d="M18.4 15.4l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"
		/></symbol
	>
	<symbol id="hqp-i-moon" viewBox="0 0 24 24"
		><path d="M19.6 14.6A8 8 0 1 1 9.4 4.4a6.4 6.4 0 0 0 10.2 10.2z" /></symbol
	>
	<symbol id="hqp-i-refresh" viewBox="0 0 24 24"
		><path d="M19.6 12.6A7.6 7.6 0 1 1 17.4 6.6" /><path d="M19.2 3.6v4.6h-4.6" /></symbol
	>
	<symbol id="hqp-i-copy" viewBox="0 0 24 24"
		><rect x="8.5" y="8.5" width="12" height="12" rx="2.4" /><path
			d="M15.5 8.5V5.9a2.4 2.4 0 0 0-2.4-2.4H5.9a2.4 2.4 0 0 0-2.4 2.4v7.2a2.4 2.4 0 0 0 2.4 2.4h2.6"
		/></symbol
	>
	<symbol id="hqp-i-share" viewBox="0 0 24 24"
		><path
			d="M12 14.5V3.6M8.2 7.2L12 3.4l3.8 3.8M8 10.2H6.4a1.4 1.4 0 0 0-1.4 1.4v7.6a1.4 1.4 0 0 0 1.4 1.4h11.2a1.4 1.4 0 0 0 1.4-1.4v-7.6a1.4 1.4 0 0 0-1.4-1.4H16"
		/></symbol
	>
	<symbol id="hqp-i-add-square" viewBox="0 0 24 24"
		><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.6v6.8M8.6 12h6.8" /></symbol
	>
</svg>

<style>
	.hqp-sprite {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
	}
</style>
