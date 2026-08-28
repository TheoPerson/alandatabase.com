import { error } from '@sveltejs/kit';
import { hasPermission } from './permissions';

type OwnerCandidate = {
	role?: unknown;
};

export function isOwnerUser(user: OwnerCandidate | null | undefined): user is OwnerCandidate {
	return hasPermission(user, 'system:manage');
}

export function requireOwnerUser(user: OwnerCandidate | null | undefined) {
	if (!isOwnerUser(user)) {
		throw error(403, 'Owner access required.');
	}
}

export function requireCatalogManager(user: OwnerCandidate | null | undefined) {
	if (!hasPermission(user, 'catalog:manage')) {
		throw error(403, 'Catalog management access required.');
	}
}
