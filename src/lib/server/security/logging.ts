import { sanitizeTelemetryText } from '$lib/telemetry-privacy';

export function safeDiagnostic(value: unknown): string {
	const rawValue = value instanceof Error ? value.message : String(value);

	return sanitizeTelemetryText(rawValue).slice(0, 350);
}

export function logServerError(context: string, error: unknown): void {
	console.error(`${context}: ${safeDiagnostic(error)}`);
}
