// The only origin the cinema may frame: the official trailer embed. Every
// incoming frame-src directive is replaced, never merged, so a permissive
// upstream header can never widen this list.
export const ALLOWED_FRAME_SOURCES = ['https://www.youtube-nocookie.com'] as const;

export function denyFrameSources(existingPolicy: string | null | undefined): string {
	const directives = (existingPolicy ?? '')
		.split(';')
		.map((directive) => directive.trim())
		.filter(Boolean)
		.filter((directive) => !/^frame-src(?:\s|$)/i.test(directive));
	directives.push(`frame-src ${ALLOWED_FRAME_SOURCES.join(' ')}`);
	return `${directives.join('; ')};`;
}
