import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

const ORIGINAL_ENV = { ...process.env };

function createRequest(body: unknown, secret?: string): Request {
	return new Request('http://localhost/api/telegram/webhook', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...(secret ? { 'x-telegram-bot-api-secret-token': secret } : {})
		},
		body: JSON.stringify(body)
	});
}

async function callWebhook(request: Request): Promise<Response> {
	return POST({ request } as Parameters<typeof POST>[0]) as Promise<Response>;
}

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
	vi.restoreAllMocks();
});

describe('Telegram webhook boundary', () => {
	it('fails closed when integration configuration is incomplete', async () => {
		delete process.env.TELEGRAM_BOT_TOKEN;
		delete process.env.TELEGRAM_WEBHOOK_SECRET;
		delete process.env.TELEGRAM_ALLOWED_CHAT_IDS;

		const response = await callWebhook(createRequest({ message: { text: '/help' } }));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'Telegram integration is not configured' });
	});

	it('rejects an invalid webhook secret before processing a message', async () => {
		process.env.TELEGRAM_BOT_TOKEN = 'configured-token';
		process.env.TELEGRAM_WEBHOOK_SECRET = 'expected-secret';
		process.env.TELEGRAM_ALLOWED_CHAT_IDS = '123';

		const response = await callWebhook(
			createRequest({ message: { chat: { id: 123 }, text: '/help' } }, 'wrong-secret')
		);

		expect(response.status).toBe(401);
	});

	it('rejects messages from chats outside the explicit allowlist', async () => {
		process.env.TELEGRAM_BOT_TOKEN = 'configured-token';
		process.env.TELEGRAM_WEBHOOK_SECRET = 'expected-secret';
		process.env.TELEGRAM_ALLOWED_CHAT_IDS = '123';
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		const response = await callWebhook(
			createRequest({ message: { chat: { id: 456 }, text: '/help' } }, 'expected-secret')
		);

		expect(response.status).toBe(403);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('does not allow legacy mutation or playback commands', async () => {
		process.env.TELEGRAM_BOT_TOKEN = 'configured-token';
		process.env.TELEGRAM_WEBHOOK_SECRET = 'expected-secret';
		process.env.TELEGRAM_ALLOWED_CHAT_IDS = '123';
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		const response = await callWebhook(
			createRequest(
				{ message: { chat: { id: 123 }, text: '/ingest Inception' } },
				'expected-secret'
			)
		);

		expect(response.status).toBe(400);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
