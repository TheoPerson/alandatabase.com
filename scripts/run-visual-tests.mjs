import { spawnSync } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(
	pnpm,
	['exec', 'playwright', 'test', 'tests/visual.e2e.ts', ...process.argv.slice(2)],
	{
		stdio: 'inherit',
		env: { ...process.env, VISUAL_REGRESSION: '1' }
	}
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
