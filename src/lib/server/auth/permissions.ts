export const USER_ROLES = ['owner', 'admin', 'member'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const AUTH_PERMISSIONS = [
	'account:access',
	'catalog:manage',
	'invites:manage',
	'roles:manage',
	'system:manage'
] as const;

export type AuthPermission = (typeof AUTH_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<AuthPermission>> = {
	owner: new Set(AUTH_PERMISSIONS),
	admin: new Set<AuthPermission>(['catalog:manage']),
	member: new Set<AuthPermission>()
};

export function parseUserRole(value: unknown): UserRole | null {
	return typeof value === 'string' && USER_ROLES.includes(value as UserRole)
		? (value as UserRole)
		: null;
}

export function hasPermission(
	user: { role?: unknown } | null | undefined,
	permission: AuthPermission
): boolean {
	const role = parseUserRole(user?.role);
	return role ? ROLE_PERMISSIONS[role].has(permission) : false;
}

export function canAssignRole(role: unknown): role is Exclude<UserRole, 'owner'> {
	return role === 'admin' || role === 'member';
}
