import * as Sentry from '@sentry/sveltekit';

const DSN = 'https://fcd5c306ca6264af03ec42d4c03ef816@o4511905549254656.ingest.de.sentry.io/4511905561051216';

Sentry.init({
	dsn: DSN,
	tracesSampleRate: 1.0,
	environment: 'production'
});

async function main() {
	console.log('📡 Sending verification event to Sentry project "javascript-sveltekit"...');
	
	const eventId = Sentry.captureException(new Error('AlanDatabase 2026 Production Verification Exception'));
	console.log(`✅ Event sent! Sentry Event ID: ${eventId}`);
	
	const flushed = await Sentry.flush(5000);
	console.log(`🚀 Sentry Flush Result: ${flushed ? 'Success (200 OK)' : 'Timed out'}`);
}

main().catch(console.error);
