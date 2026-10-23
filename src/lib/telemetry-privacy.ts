const URL_PATTERN = /\b(?:postgres(?:ql)?|https?):\/\/[^\s]+/giu;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu;
const SECRET_ASSIGNMENT_PATTERN =
	/\b(token|secret|password|authorization|api[_-]?key)\b\s*[:=]\s*[^\s,;]+/giu;
// Library and cache files: Windows drive paths (F:\MOVIES\..., C:/cache/...) and UNC shares.
const DRIVE_PATH_PATTERN = /(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s|)"'<>]*/gu;
const UNC_PATH_PATTERN = /\\\\[^\s|)"'<>]+/gu;

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
		.replace(UNC_PATH_PATTERN, '[redacted-path]')
		.replace(DRIVE_PATH_PATTERN, '[redacted-path]')
		.replace(BEARER_PATTERN, 'Bearer [redacted]')
		.replace(SECRET_ASSIGNMENT_PATTERN, '$1=[redacted]')
		.replace(/[<>"']/gu, '');
}

type TelemetryBreadcrumb = {
	category?: string;
	message?: string;
	data?: Record<string, unknown>;
};

/**
 * Console breadcrumbs of the owner's media server ("[media] ...") can name library files: they are
 * dropped. Other console breadcrumbs keep a redacted message and lose their raw arguments.
 */
export function scrubBreadcrumb<T extends TelemetryBreadcrumb>(breadcrumb: T): T | null {
	if (breadcrumb.category !== 'console') return breadcrumb;
	const message = breadcrumb.message ?? '';
	if (message.trimStart().startsWith('[media]')) return null;
	const scrubbed = { ...breadcrumb };
	if (scrubbed.message) scrubbed.message = sanitizeTelemetryText(scrubbed.message).slice(0, 1_000);
	delete scrubbed.data;
	return scrubbed;
}

/** No traces for the private player and its media API (paths, timings of the owner's viewing). */
export function tracesSampler(context: {
	name: string;
	inheritOrSampleWith: (fallbackSampleRate: number) => number;
}): number {
	if (/\/api\/media(?:\/|$)|\/watch(?:\/|$)/u.test(context.name)) return 0;
	return context.inheritOrSampleWith(0.1);
}

type TelemetryEvent = {
	message?: string;
	exception?: { values?: Array<{ value?: string }> };
	breadcrumbs?: TelemetryBreadcrumb[];
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

	if (event.breadcrumbs) {
		event.breadcrumbs = event.breadcrumbs
			.map((breadcrumb) => scrubBreadcrumb(breadcrumb))
			.filter((breadcrumb): breadcrumb is TelemetryBreadcrumb => breadcrumb !== null);
	}

	if (event.request) {
		delete event.request.data;
		delete event.request.cookies;
		delete event.request.headers;
		delete event.request.query_string;
	}

	return event;
}
