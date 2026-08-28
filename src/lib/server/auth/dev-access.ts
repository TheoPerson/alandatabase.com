export const DEV_BYPASS_USER: NonNullable<App.Locals['user']> = {
	id: '00000000-0000-4000-8000-000000000000',
	email: 'dev-bypass@localhost',
	username: 'dev-bypass',
	displayName: 'Local development',
	avatarPath: null,
	role: 'owner',
	disabledAt: null,
	settings: { hasAcceptedAdultGate: true }
};

export function isDevAuthBypassEnabled(env: NodeJS.ProcessEnv = process.env) {
	return env.NODE_ENV === 'development' && env.ALLOW_DEV_AUTH_BYPASS === 'true';
}
