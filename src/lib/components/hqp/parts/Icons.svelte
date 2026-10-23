<!-- The HQP icon sprite: one inline SVG of <symbol>s, viewBox 24, stroke 1.8, round caps. Rendered
once by HqpPlayer; every icon is a <use> of it, so glyphs stay vector-crisp at DPR 3. Glyphs only
the lazy panels and the desktop bar use live in IconsMore.svelte (loaded with them). -->
<svg class="hqp-sprite" aria-hidden="true" focusable="false">
	<symbol id="hqp-i-chevron-down" viewBox="0 0 24 24"><path d="M6 9.5l6 6 6-6" /></symbol>
	<symbol id="hqp-i-close" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></symbol>
	<symbol id="hqp-i-play" viewBox="0 0 24 24"
		><path
			fill="currentColor"
			stroke="none"
			d="M7.6 5.3v13.4a1.2 1.2 0 0 0 1.82 1.03l11-6.7a1.2 1.2 0 0 0 0-2.06l-11-6.7A1.2 1.2 0 0 0 7.6 5.3z"
		/></symbol
	>
	<symbol id="hqp-i-pause" viewBox="0 0 24 24"
		><rect
			fill="currentColor"
			stroke="none"
			x="6"
			y="4.8"
			width="4.4"
			height="14.4"
			rx="1.5"
		/><rect
			fill="currentColor"
			stroke="none"
			x="13.6"
			y="4.8"
			width="4.4"
			height="14.4"
			rx="1.5"
		/></symbol
	>
	<symbol id="hqp-i-back-10" viewBox="0 0 24 24"
		><path d="M4.4 13.2A7.6 7.6 0 1 0 12 5.6" /><path d="M14.6 3l-2.6 2.6 2.6 2.6" /><text
			x="12.1"
			y="16.3"
			text-anchor="middle"
			font-size="7.2"
			font-weight="800"
			letter-spacing="-0.3"
			fill="currentColor"
			stroke="none">10</text
		></symbol
	>
	<symbol id="hqp-i-forward-10" viewBox="0 0 24 24"
		><path d="M19.6 13.2A7.6 7.6 0 1 1 12 5.6" /><path d="M9.4 3l2.6 2.6L9.4 8.2" /><text
			x="11.9"
			y="16.3"
			text-anchor="middle"
			font-size="7.2"
			font-weight="800"
			letter-spacing="-0.3"
			fill="currentColor"
			stroke="none">10</text
		></symbol
	>
	<symbol id="hqp-i-airplay" viewBox="0 0 24 24"
		><path
			d="M6.5 17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-1.5"
		/><path fill="currentColor" stroke-width="1.2" d="M12 14.2l4.3 5.3H7.7z" /></symbol
	>
	<symbol id="hqp-i-pip" viewBox="0 0 24 24"
		><rect x="3" y="5" width="18" height="14" rx="2.6" /><rect
			fill="currentColor"
			stroke="none"
			x="11.6"
			y="11.2"
			width="7"
			height="5.4"
			rx="1.3"
		/></symbol
	>
	<symbol id="hqp-i-pip-exit" viewBox="0 0 24 24"
		><rect x="3" y="5" width="18" height="14" rx="2.6" /><path
			d="M14.5 9.5l-5 5M9.5 10v4.5H14"
		/></symbol
	>
	<symbol id="hqp-i-lock" viewBox="0 0 24 24"
		><rect x="5" y="10.5" width="14" height="10" rx="2.6" /><path
			d="M8.5 10.5V7.6a3.5 3.5 0 0 1 7 0v2.9"
		/></symbol
	>
	<symbol id="hqp-i-info" viewBox="0 0 24 24"
		><circle cx="12" cy="12" r="9" /><path d="M12 11v5.4" /><circle
			fill="currentColor"
			stroke="none"
			cx="12"
			cy="7.8"
			r="1.15"
		/></symbol
	>
	<symbol id="hqp-i-subtitles" viewBox="0 0 24 24"
		><rect x="3" y="5.5" width="18" height="13" rx="2.6" /><path
			d="M7 11h3M12.6 11H17M7 14.6h6M15.6 14.6H17"
		/></symbol
	>
	<symbol id="hqp-i-speed" viewBox="0 0 24 24"
		><path d="M4.7 17.6a8.6 8.6 0 1 1 14.6 0" /><path d="M12 13.6l3.6-4.1" /><circle
			fill="currentColor"
			stroke="none"
			cx="12"
			cy="13.6"
			r="1.4"
		/></symbol
	>
	<symbol id="hqp-i-episodes" viewBox="0 0 24 24"
		><rect x="3.5" y="9" width="17" height="11" rx="2.4" /><path d="M6 6h12M8.5 3.4h7" /></symbol
	>
	<symbol id="hqp-i-next" viewBox="0 0 24 24"
		><path
			fill="currentColor"
			stroke="none"
			d="M5.6 6.1v11.8a1.1 1.1 0 0 0 1.7.9l8.6-5.9a1.1 1.1 0 0 0 0-1.8L7.3 5.2a1.1 1.1 0 0 0-1.7.9z"
		/><path d="M18.6 5.2v13.6" stroke-width="2.2" /></symbol
	>
	<symbol id="hqp-i-alert" viewBox="0 0 24 24"
		><path d="M10.3 4.6a2 2 0 0 1 3.4 0l7.4 12.9a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3z" /><path
			d="M12 9.8v4.4"
		/><circle fill="currentColor" stroke="none" cx="12" cy="17" r="1.1" /></symbol
	>
	<symbol id="hqp-i-wifi-off" viewBox="0 0 24 24"
		><path
			d="M2.6 8.6a14 14 0 0 1 4.3-2.7M10.6 5.1a14 14 0 0 1 10.8 3.5M5.6 12a9.6 9.6 0 0 1 3.1-1.9M15.2 10.4a9.6 9.6 0 0 1 3.2 1.6M8.9 15.3a4.6 4.6 0 0 1 6.2 0M3.5 3.5l17 17"
		/><circle fill="currentColor" stroke="none" cx="12" cy="18.8" r="1.2" /></symbol
	></svg
>

<style>
	.hqp-sprite {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
	}
</style>
