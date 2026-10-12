export function denyFrameSources(existingPolicy: string | null | undefined): string {
	const directives = (existingPolicy ?? '')
		.split(';')
		.map((directive) => directive.trim())
		.filter(Boolean)
		.filter((directive) => !/^frame-src(?:\s|$)/i.test(directive));

	directives.push("frame-src 'none'");
	return `${directives.join('; ')};`;
}
