import * as Sentry from '@sentry/sveltekit';
import { SENTRY_DATA_COLLECTION, scrubTelemetryEvent } from '$lib/telemetry-privacy';

Sentry.init({
	dsn: 'https://fcd5c306ca6264af03ec42d4c03ef816@o4511905549254656.ingest.de.sentry.io/4511905561051216',

	tracesSampleRate: 0.1,
	enableLogs: false,
	dataCollection: SENTRY_DATA_COLLECTION,
	beforeSend: scrubTelemetryEvent

	// uncomment the line below to enable Spotlight (https://spotlightjs.com)
	// spotlight: import.meta.env.DEV,
});
