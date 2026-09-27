// Test cho getServerPublicKey của encryption module — CryptoKey cache theo b64,
// re-import khi key đổi (onServerKeyChange), getServerPublicKeyB64 delegate sang server-key
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock server-key module — encryption.ts delegate lấy b64 qua đây
const serverKeyMock = vi.hoisted(() => {
	const listeners = new Set<(b64: string) => void>();
	let currentB64: string | undefined;
	return {
		getServerPublicKeyB64: vi.fn(async () => currentB64),
		onServerKeyChange: vi.fn((listener: (b64: string) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}),
		_setB64ForTests: (b64: string | undefined) => {
			currentB64 = b64;
			if (b64 !== undefined) for (const l of listeners) l(b64);
		},
		_listenersForTests: listeners
	};
});

vi.mock('$modules/server-key', () => serverKeyMock);

import { encryption } from '$modules/encryption';

describe('encryption.getServerPublicKey caching', () => {
	beforeEach(() => {
		serverKeyMock._setB64ForTests(undefined);
	});

	it('getServerPublicKeyB64 delegate sang server-key module', async () => {
		serverKeyMock._setB64ForTests('b64-from-delegate');
		// KHÔNG trigger listeners vì _setB64ForTests với giá trị mới sẽ gọi listener —
		// nhưng getServerPublicKeyB64 của mock trả currentB64 trực tiếp.
		await expect(encryption.getServerPublicKeyB64()).resolves.toBe('b64-from-delegate');
		expect(serverKeyMock.getServerPublicKeyB64).toHaveBeenCalled();
	});

	it('import CryptoKey từ b64 và cache — lần sau không import lại', async () => {
		const { publicKey } = await encryption.generateRSAKeyPair();
		const b64 = await encryption.exportKeyToBase64(publicKey, 'spki');
		// Reset listener state b64 không trigger (undefined skip listeners)
		serverKeyMock._setB64ForTests(b64);

		const key1 = await encryption.getServerPublicKey();
		expect(key1).toBeInstanceOf(Object);
		expect(key1?.type).toBe('public');
		expect(key1?.algorithm.name).toBe('RSA-OAEP');

		// Lần 2: cùng b64 → trả đúng instance đã cache
		const key2 = await encryption.getServerPublicKey();
		expect(key2).toBe(key1);
	});

	it('key đổi (WS broadcast) → clear cache, import lại key mới', async () => {
		const kp1 = await encryption.generateRSAKeyPair();
		const kp2 = await encryption.generateRSAKeyPair();
		const b64_1 = await encryption.exportKeyToBase64(kp1.publicKey, 'spki');
		const b64_2 = await encryption.exportKeyToBase64(kp2.publicKey, 'spki');

		serverKeyMock._setB64ForTests(b64_1);
		const key1 = await encryption.getServerPublicKey();
		expect(key1).toBeDefined();

		// Giả lập PartyKit broadcast key mới → listener phải clear cache
		serverKeyMock._setB64ForTests(b64_2);
		const key2 = await encryption.getServerPublicKey();

		expect(key2).toBeDefined();
		expect(key2).not.toBe(key1);
	});

	it('không có key (b64 undefined) → trả undefined', async () => {
		serverKeyMock._setB64ForTests(undefined);
		await expect(encryption.getServerPublicKey()).resolves.toBeUndefined();
	});
});
