import 'dotenv/config';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import postgres from 'postgres';
import {
	hashPassword,
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH
} from '../src/lib/server/auth/password-hash';

// Operator command: set a new password for one account and revoke all of its sessions.
// The password is typed twice at a hidden prompt (never an argument, never logged).
const CONFIRMATION = 'set-user-password';
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{1,64}$/u;

function getArgument(name: string): string | null {
	const prefix = `--${name}=`;
	const inline = process.argv.find((argument) => argument.startsWith(prefix));
	if (inline) return inline.slice(prefix.length).trim() || null;

	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}

function promptHidden(question: string): Promise<string> {
	if (!process.stdin.isTTY) {
		return Promise.reject(new Error('Run this in an interactive terminal: the password is typed.'));
	}
	let muted = false;
	const output = new Writable({
		write(chunk, _encoding, callback) {
			if (!muted) process.stdout.write(chunk);
			callback();
		}
	});
	const reader = createInterface({ input: process.stdin, output, terminal: true });
	return new Promise((resolve) => {
		reader.question(question, (answer) => {
			reader.close();
			process.stdout.write('\n');
			resolve(answer);
		});
		muted = true;
	});
}

async function setUserPassword() {
	const username = getArgument('username');
	const connectionString = process.env.WORKER_DATABASE_URL?.trim();

	if (!username || !USERNAME_PATTERN.test(username)) {
		throw new Error('Pass the account as --username <name>.');
	}
	if (!connectionString) {
		throw new Error('WORKER_DATABASE_URL is required for this explicit operator mutation.');
	}
	if (process.env.PASSWORD_RESET_CONFIRM !== CONFIRMATION) {
		throw new Error(`Set PASSWORD_RESET_CONFIRM=${CONFIRMATION} for this one command.`);
	}

	const password = await promptHidden('New password: ');
	if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
		throw new Error(
			`The password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters.`
		);
	}
	if ((await promptHidden('Repeat it: ')) !== password) {
		throw new Error('The two passwords differ. Nothing was changed.');
	}
	const passwordHash = await hashPassword(password);

	const sql = postgres(connectionString, {
		prepare: false,
		max: 1,
		connect_timeout: 10,
		idle_timeout: 5
	});

	try {
		const revoked = await sql.begin(async (transaction) => {
			const [target] = await transaction<{ id: string }[]>`
				select id from users where username = ${username} for update
			`;
			if (!target) throw new Error('The requested account does not exist.');

			await transaction`
				update users set password_hash = ${passwordHash}, updated_at = now()
				where id = ${target.id}::uuid
			`;
			const sessions = await transaction`
				update sessions set revoked_at = now()
				where user_id = ${target.id}::uuid and revoked_at is null
				returning id
			`;
			await transaction`
				insert into auth_audit_events (target_user_id, action, metadata)
				values (${target.id}::uuid, 'password.reset',
					${transaction.json({ source: 'operator-script', revokedSessions: sessions.length })})
			`;
			return sessions.length;
		});

		console.info(`Password changed. ${revoked} session(s) signed out; sign in again.`);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

setUserPassword().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : 'Unknown failure.';
	console.error(`Password reset failed: ${message}`);
	process.exitCode = 1;
});
