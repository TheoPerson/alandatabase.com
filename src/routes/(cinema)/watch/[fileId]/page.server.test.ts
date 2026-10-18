import { beforeEach, describe, expect, it, vi } from 'vitest';

const launch = vi.hoisted(() => ({ buildLaunchPayload: vi.fn() }));
vi.mock('$lib/server/hqp/launch', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/hqp/launch')>()),
	buildLaunchPayload: launch.buildLaunchPayload
}));

import { load } from './+page.server';

const FILE = '00000000-0000-4000-8000-000000000001';
const owner = { id: '00000000-0000-4000-8000-0000000000aa', role: 'owner', username: 'alan' };
const member = { id: '00000000-0000-4000-8000-0000000000bb', role: 'member', username: 'guest' };
const payload = {
	queue: [{ fileId: FILE, titleHref: '/movies/x' }],
	index: 0,
	returnHref: '/movies/x'
};

function run(user: unknown, fileId = FILE, search = '') {
	const setHeaders = vi.fn();
	const result = (load as (event: unknown) => Promise<any>)({
		params: { fileId },
		locals: { user },
		url: new URL(`https://alandatabase.com/watch/${fileId}${search}`),
		setHeaders
	});
	return { result, setHeaders };
}

beforeEach(() => {
	launch.buildLaunchPayload.mockReset();
	launch.buildLaunchPayload.mockResolvedValue(payload);
});

describe('/watch/[fileId] loader', () => {
	it('sends an anonymous visitor to sign in and back', async () => {
		await expect(run(null).result).rejects.toMatchObject({
			status: 302,
			location: `/auth/login?returnTo=${encodeURIComponent(`/watch/${FILE}`)}`
		});
		expect(launch.buildLaunchPayload).not.toHaveBeenCalled();
	});

	it('answers 404 to a signed-in member without reading the library', async () => {
		await expect(run(member).result).rejects.toMatchObject({ status: 404 });
		expect(launch.buildLaunchPayload).not.toHaveBeenCalled();
	});

	it.each(['not-a-uuid', '1', `${FILE}x`, "' or 1=1"])('answers 404 for the id %s', async (id) => {
		await expect(run(owner, id).result).rejects.toMatchObject({ status: 404 });
		expect(launch.buildLaunchPayload).not.toHaveBeenCalled();
	});

	it('answers 404 when the file is unknown or not visible', async () => {
		launch.buildLaunchPayload.mockResolvedValue(null);
		await expect(run(owner).result).rejects.toMatchObject({ status: 404 });
	});

	it('gives the owner the launch payload, private and never cached', async () => {
		const { result, setHeaders } = run(owner);
		expect(await result).toEqual({ launch: payload, startAt: 'resume' });
		expect(launch.buildLaunchPayload).toHaveBeenCalledWith(owner.id, FILE);
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
	});

	it('reads ?t= as a start time in whole seconds, else resumes', async () => {
		expect((await run(owner, FILE, '?t=0').result).startAt).toBe(0);
		expect((await run(owner, FILE, '?t=754').result).startAt).toBe(754);
		expect((await run(owner, FILE, '?t=abc').result).startAt).toBe('resume');
		expect((await run(owner, FILE, '?t=999999').result).startAt).toBe('resume');
	});
});
