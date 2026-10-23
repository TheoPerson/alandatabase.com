import { error, redirect } from '@sveltejs/kit';
import { getAuthPortalUrl } from '$lib/host-routing';
import { isOwnerUser } from '$lib/server/auth/owner';

export function load({ locals, url }) {
	if (!locals.user) {
		throw redirect(302, getAuthPortalUrl(url, '/admin'));
	}

	if (!isOwnerUser(locals.user)) {
		throw error(403, 'Owner access required.');
	}

	return {
		user: {
			displayName: locals.user.displayName,
			email: locals.user.email,
			role: locals.user.role
		},
		surfaces: [
			{
				name: 'Access Control',
				host: 'alandatabase.com/admin/access',
				href: '/admin/access',
				access: 'Owner only'
			},
			{
				name: 'Public Status',
				host: 'status.alandatabase.com',
				href: 'https://status.alandatabase.com/',
				access: 'Public read-only'
			},
			{
				name: 'API Information',
				host: 'api.alandatabase.com',
				href: 'https://api.alandatabase.com/',
				access: 'Public metadata and health'
			},
			{
				name: 'Authentication',
				host: 'auth.alandatabase.com',
				href: 'https://auth.alandatabase.com/auth/login',
				access: 'Private sign-in'
			},
			{
				name: 'System Setup',
				host: 'alandatabase.com/setup',
				href: '/setup',
				access: 'Owner only'
			},
			{
				name: 'Catalogue Operations',
				host: 'alandatabase.com/movies/catalog',
				href: '/movies/catalog',
				access: 'Owner or admin mutations'
			}
		]
	};
}
