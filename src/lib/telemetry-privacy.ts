const URL_PATTERN = /\b(?:postgres(?:ql)?|https?):\/\/[^\s]+/giu;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu;
const SECRET_ASSIGNMENT_PATTERN =
	/\b(token|secret|password|authorization|api[_-]?key)\b\s*[:=]\s*[^\s,;]+/giu;

export const SENTRY_DATA_COLLECTION = {
	userInfo: false,
	cookies: false,
	httpHeaders: {
		request: false,
		response: false
	},
	httpBodies: [],
	urlQueryParams: false,
	graphQL: {
		document: false,
		variables: false
	},
	genAI: {
		inputs: false,
		outputs: false
	},
	databaseQueryData: false,
	stackFrameVariables: false,
	frameContextLines: 2
};

export function sanitizeTelemetryText(value: unknown): string {
	return String(value)
		.replace(URL_PATTERN, '[redacted-url]')
		.replace(BEARER_PATTERN, 'Bearer [redacted]')
		.replace(SECRET_ASSIGNMENT_PATTERN, '$1=[redacted]')
		.replace(/[<>"']/gu, '');
}

type TelemetryEvent = {
	message?: string;
	exception?: { values?: Array<{ value?: string }> };
	request?: {
		data?: unknown;
		cookies?: unknown;
		headers?: unknown;
		query_string?: unknown;
	};
};

export function scrubTelemetryEvent<T extends TelemetryEvent>(event: T): T {
	if (event.message) event.message = sanitizeTelemetryText(event.message).slice(0, 1_000);

	for (const exception of event.exception?.values ?? []) {
		if (exception.value) {
			exception.value = sanitizeTelemetryText(exception.value).slice(0, 1_000);
		}
	}

	if (event.request) {
		delete event.request.data;
		delete event.request.cookies;
		delete event.request.headers;
		delete event.request.query_string;
	}

	return event;
}
