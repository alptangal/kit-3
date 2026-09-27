// Test cho server-key module — HTTP fallback khi không có WS, cache, onKeyChange
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock $app/environment trước khi import module (browser mặc định = false → SSR path)
vi.mock('$app/environment', () => ({
	browser: false,
	dev: true
}));

import {
	getServerPublicKeyB64,
	onServerKeyChange,
	_resetForTests
} from '$modules/server-key';

const FAKE_KEY = 'K'.repeat(392);
const FAKE_KEY_2 = 'J'.repeat(392);

function mockHttpKey(key: string) {
	return vi.fn().mockResolvedValue(
		new Response(JSON.stringify({ data: { publicKeyB64: key } }), { status: 200 })
	);
}

describe('server-key module', () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		_resetForTests();
		vi.stubGlobal('fetch', fetchMock);
		fetchMock.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('không phải browser (SSR) → HTTP fallback /api/encryption/public-key', async () => {
		fetchMock.mockImplementation(mockHttpKey(FAKE_KEY));

		const key = await getServerPublicKeyB64();

		expect(key).toBe(FAKE_KEY);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe('/api/encryption/public-key');
	});

	it('cache hit → không fetch lại lần thứ hai', async () => {
		fetchMock.mockImplementation(mockHttpKey(FAKE_KEY));

		await getServerPublicKeyB64();
		await getServerPublicKeyB64();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('in-flight promise được memoize — caller đồng thời chỉ trigger 1 fetch', async () => {
		fetchMock.mockImplementation(mockHttpKey(FAKE_KEY));

		const [a, b] = await Promise.all([getServerPublicKeyB64(), getServerPublicKeyB64()]);

		expect(a).toBe(FAKE_KEY);
		expect(b).toBe(FAKE_KEY);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('HTTP lỗi → trả undefined, không throw', async () => {
		fetchMock.mockResolvedValue(new Response('Server crash', { status: 500 }));

		await expect(getServerPublicKeyB64()).resolves.toBeUndefined();
	});

	it('onServerKeyChange: gọi listener khi key broadcast đổi, và unsubscribe được', async () => {
		const listener = vi.fn();
		const unsubscribe = onServerKeyChange(listener);

		fetchMock.mockImplementation(mockHttpKey(FAKE_KEY));
		await getServerPublicKeyB64();

		// Giả lập WS broadcast key mới
		const { applyKeyForTests } = await import('$modules/server-key');
		applyKeyForTests(FAKE_KEY_2);
		// Key "đổi" từ undefined/FAKE_KEY sang FAKE_KEY_2 — listener gọi 1 lần cho
		// mỗi thay đổi THẬT SỰ (cả lần đầu set từ HTTP lẫn broadcast), nên đếm tổng
		// listener được gọi với FAKE_KEY_2 và các key khác:
		expect(listener).toHaveBeenCalledWith(FAKE_KEY_2);
		const callsWithKey2 = listener.mock.calls.filter((c) => c[0] === FAKE_KEY_2).length;
		expect(callsWithKey2).toBe(1);

		// Broadcast lại CÙNG key → không gọi listener thêm
		listener.mockClear();
		applyKeyForTests(FAKE_KEY_2);
		expect(listener).not.toHaveBeenCalled();

		// Sau unsubscribe, key mới nữa không gọi listener
		unsubscribe();
		listener.mockClear();
		applyKeyForTests(FAKE_KEY);
		expect(listener).not.toHaveBeenCalled();
	});
});
