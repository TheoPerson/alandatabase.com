// Structured data goes out as a raw <script> body. Svelte would HTML-escape a text child
// (turning "&" into "&amp;", which is invalid JSON for crawlers), so the script is emitted as
// markup instead. Every character that could end the script or the HTML context is written as a
// JSON unicode escape, which a JSON parser reads back as the original character.
const BACKSLASH = String.fromCharCode(92);
// "<" ">" "&" and the two JavaScript line separators.
const UNSAFE = new Set([0x3c, 0x3e, 0x26, 0x2028, 0x2029]);

function escapeJson(json: string): string {
	let out = '';
	for (const character of json) {
		const code = character.codePointAt(0) ?? 0;
		out += UNSAFE.has(code) ? `${BACKSLASH}u${code.toString(16).padStart(4, '0')}` : character;
	}
	return out;
}

export function jsonLdScript(value: unknown): string {
	return `<script type="application/ld+json">${escapeJson(JSON.stringify(value))}</script>`;
}
