import 'dotenv/config';
import postgres from 'postgres';

const CONFIRMATION = 'bootstrap-persistent-owner';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getArgument(name: string): string | null {
	const prefix = `--${name}=`;
	const inline = process.argv.find((argument) => argument.startsWith(prefix));
	if (inline) return inline.slice(prefix.length).trim() || null;

	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}

async function bootstrapOwnerRole() {
	const userId = getArgument('user-id');
	const connectionString = process.env.WORKER_DATABASE_URL?.trim();

	if (!userId || !UUID_PATTERN.test(userId)) {
		throw new Error('Pass one existing account as --user-id <uuid>.');
	}

	if (!connectionString) {
		throw new Error('WORKER_DATABASE_URL is required for this explicit operator mutation.');
	}

	if (process.env.OWNER_BOOTSTRAP_CONFIRM !== CONFIRMATION) {
		throw new Error(`Set OWNER_BOOTSTRAP_CONFIRM=${CONFIRMATION} for this one command.`);
	}

	const sql = postgres(connectionString, {
		prepare: false,
		max: 1,
		connect_timeout: 10,
		idle_timeout: 5
	});

	try {
		await sql.begin(async (transaction) => {
			await transaction`select pg_advisory_xact_lock(hashtext('alan_database_owner_bootstrap'))`;

			const [existingOwner] = await transaction<{ id: string }[]>`
				select id from users where role = 'owner' limit 1
			`;
			if (existingOwner) {
				throw new Error('An owner already exists. Use the access-control UI for role changes.');
			}

			const [target] = await transaction<{ id: string; disabled_at: Date | null }[]>`
				select id, disabled_at from users where id = ${userId}::uuid for update
			`;
			if (!target) throw new Error('The requested account does not exist.');
			if (target.disabled_at) throw new Error('The requested account is disabled.');

			await transaction`
				update users set role = 'owner', updated_at = now() where id = ${userId}::uuid
			`;
			await transaction`
				insert into auth_audit_events (target_user_id, action, metadata)
				values (${userId}::uuid, 'owner.bootstrap', ${transaction.json({ source: 'operator-script' })})
			`;
		});

		console.info('Persistent owner role assigned successfully.');
	} finally {
		await sql.end({ timeout: 5 });
	}
}

bootstrapOwnerRole().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : 'Unknown bootstrap failure.';
	console.error(`Owner bootstrap failed: ${message}`);
	process.exitCode = 1;
});
