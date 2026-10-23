import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Plain module (no $lib imports) so operator scripts hash exactly like the app.
const scryptAsync = promisify(scrypt);

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

// Password Hashing with Scrypt (Salt + Hash)
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const buf = (await scryptAsync(password, salt, 64)) as Buffer;
	return `${salt}:${buf.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const [salt, keyHex] = storedHash.split(':');
	if (!salt || !keyHex || !/^[a-f0-9]{128}$/i.test(keyHex)) return false;

	const keyBuf = Buffer.from(keyHex, 'hex');
	const derivedBuf = (await scryptAsync(password, salt, 64)) as Buffer;

	if (keyBuf.length !== derivedBuf.length) return false;
	return timingSafeEqual(keyBuf, derivedBuf);
}
