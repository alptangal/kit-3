// Test cho push public key sang PartyKit — retry/backoff, auth header, không throw
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Module đọc env qua $env/dynamic/private — mock để điều khiển giá trị trong test
const testEnv = vi.hoisted(() => ({}) as Record<string, string | undefined>);
vi.mock('$env/dynamic/private', () => ({ env: testEnv }));

const { pushPublicKeyToPartyKit } = await import('./partykit-push');

const FAKE_KEY = 'A'.repeat(392); // giả lập base64 SPKI RSA-2048

describe('pushPublicKeyToPartyKit', () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		vi.stubGlobal('fetch', fetchMock);
		fetchMock.mockReset();
		for (const key of Object.keys(testEnv)) delete testEnv[key];
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('POST key với Bearer token đến URL mặc định và dừng khi thành công', async () => {
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

		await pushPublicKeyToPartyKit(FAKE_KEY);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('http://localhost:1999/party/server-keys');
		expect(init.method).toBe('POST');
		expect(init.headers.authorization).toBe('Bearer dev-insecure-token-change-me');
		expect(JSON.parse(init.body)).toEqual({ publicKeyB64: FAKE_KEY });
	});

	it('dùng env PARTYKIT_PUSH_URL + PARTYKIT_INTERNAL_TOKEN khi có', async () => {
		testEnv.PARTYKIT_PUSH_URL = 'http://example.internal/party/server-keys';
		testEnv.PARTYKIT_INTERNAL_TOKEN = 'secret-token';
		fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

		await pushPublicKeyToPartyKit(FAKE_KEY);

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('http://example.internal/party/server-keys');
		expect(init.headers.authorization).toBe('Bearer secret-token');
	});

	it('401 (token sai) → không retry, không throw', async () => {
		fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

		await expect(pushPublicKeyToPartyKit(FAKE_KEY, { maxRetries: 5 })).resolves.toBeUndefined();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('network error → retry với exponential backoff rồi bỏ im lặng', async () => {
		vi.useFakeTimers();
		fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

		// maxRetries=3, backoff 100ms → 100, 200
		const promise = pushPublicKeyToPartyKit(FAKE_KEY, { maxRetries: 3, initialBackoffMs: 100 });
		await vi.advanceTimersByTimeAsync(350);

		await expect(promise).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('status 5xx → retry rồi thành công', async () => {
		vi.useFakeTimers();
		fetchMock
			.mockResolvedValueOnce(new Response('{}', { status: 500 }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }));

		const promise = pushPublicKeyToPartyKit(FAKE_KEY, { maxRetries: 3, initialBackoffMs: 100 });
		await vi.advanceTimersByTimeAsync(150);

		await expect(promise).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
