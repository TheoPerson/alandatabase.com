import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: 'https://fcd5c306ca6264af03ec42d4c03ef816@o4511905549254656.ingest.de.sentry.io/4511905561051216',

	tracesSampleRate: 1.0,

	// Enable logs to be sent to Sentry
	enableLogs: true

	// uncomment the line below to enable Spotlight (https://spotlightjs.com)
	// spotlight: import.meta.env.DEV,
});
