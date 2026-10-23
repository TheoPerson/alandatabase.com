import { sanitizeTelemetryText } from '$lib/telemetry-privacy';

// Database drivers wrap the useful reason (for example PostgreSQL's
// "column x does not exist") in `cause`, behind a long "Failed query: ..." message
// that the length bound would otherwise cut off. Lead with the cause.
function describeError(value: unknown): string {
	if (!(value instanceof Error)) return String(value);
	if (!(value.cause instanceof Error)) return value.message;

	const code = (value.cause as { code?: unknown }).code;
	const prefix = typeof code === 'string' ? `[${code}] ` : '';
	return `${prefix}${value.cause.message} (from: ${value.message})`;
}

export function safeDiagnostic(value: unknown): string {
	return sanitizeTelemetryText(describeError(value)).slice(0, 350);
}

export function logServerError(context: string, error: unknown): void {
	console.error(`${context}: ${safeDiagnostic(error)}`);
}
