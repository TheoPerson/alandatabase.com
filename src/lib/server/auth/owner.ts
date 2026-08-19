import { error } from '@sveltejs/kit';

type OwnerCandidate = {
	id?: string | null;
	email?: string | null;
};

function configuredValues(name: string) {
	return new Set(
		(process.env[name] ?? '')
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean)
	);
}

export function isOwnerUser(user: OwnerCandidate | null | undefined): user is OwnerCandidate {
	if (!user) return false;

	const ownerIds = configuredValues('OWNER_USER_IDS');
	const ownerEmails = new Set(
		Array.from(configuredValues('OWNER_EMAILS')).map((email) => email.toLowerCase())
	);

	if (user.id && ownerIds.has(user.id)) return true;
	if (user.email && ownerEmails.has(user.email.toLowerCase())) return true;

	return false;
}

export function requireOwnerUser(user: OwnerCandidate | null | undefined) {
	if (!isOwnerUser(user)) {
		throw error(403, 'Owner access required.');
	}
}
