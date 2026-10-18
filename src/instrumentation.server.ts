import * as Sentry from '@sentry/sveltekit';
import {
	SENTRY_DATA_COLLECTION,
	scrubBreadcrumb,
	scrubTelemetryEvent,
	tracesSampler
} from '$lib/telemetry-privacy';

Sentry.init({
	dsn: 'https://fcd5c306ca6264af03ec42d4c03ef816@o4511905549254656.ingest.de.sentry.io/4511905561051216',

	// 10% of traces, none for the private player and its media API.
	tracesSampler,
	enableLogs: false,
	dataCollection: SENTRY_DATA_COLLECTION,
	beforeSend: scrubTelemetryEvent,
	// Media server logs can name library files: never sent as breadcrumbs.
	beforeBreadcrumb: scrubBreadcrumb

	// uncomment the line below to enable Spotlight (https://spotlightjs.com)
	// spotlight: import.meta.env.DEV,
});
