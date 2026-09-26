// src/lib/server/admin/getUserFromToken.test.ts
//
// Tests cho session parsing mới trong hooks.server.ts — dual-path:
// verifyAccessToken (JWT) fail thì fallback parse base64 JSON { userId, username,
// roleId, issuedAt } — đây là format cookie mà /api/login thực sự ghi hiện nay.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// verifyAccessToken phải fail cho mọi token (giả lập đúng hành vi hiện tại:
// keypair ES256 trong bộ nhớ được regenerate mỗi lần boot nên JWT cũ không verify nổi)
vi.mock('$lib/server/jwt', () => ({
	verifyAccessToken: vi.fn().mockRejectedValue(new Error('Invalid token signature'))
}));

vi.mock('$store/init-app', () => ({
	initApp: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$store/initSystemVault', () => ({
	systemVault: {
		privateKey: {} as CryptoKey,
		publicKey: {} as CryptoKey,
		indexKey: new Uint8Array(32)
	},
	initSystemVault: vi.fn().mockResolvedValue(undefined)
}));

// name_roles lookup — trả name theo documentKey
vi.mock('$modules/couchbase/clients', () => {
	const mockRolesGet = vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		data: { name: 'owner', level: 100 }
	});
	return {
		cbData: vi.fn((collectionName: string) => {
			if (collectionName === 'name_roles') {
				return { document: { get: mockRolesGet } };
			}
			return { document: { get: vi.fn(), create: vi.fn(), update: vi.fn(), query: vi.fn(), search: vi.fn() } };
		}),
		cbVault: vi.fn(() => ({ document: {} })),
		__mockRolesGet: mockRolesGet
	};
});

// Import hooks.server.ts — module-level awaits (initApp/initSystemVault) đều đã mock.
// Relative path: file này nằm ở src/lib/server/admin → src/hooks.server cách 3 cấp.
const { getUserFromToken } = await import('../../../hooks.server');
// Mock __mock* không có trong type thật của clients.ts — ép kiểu như race-condition tests
const { __mockRolesGet } = (await import('$modules/couchbase/clients')) as any;

/** Tạo session cookie giống /api/login: base64 JSON { userId, username, roleId, issuedAt } */
function makeSessionToken(payload: { userId: string; username: string; roleId: string; issuedAt: number }) {
	return Buffer.from(JSON.stringify(payload)).toString('base64');
}

describe('getUserFromToken — base64 JSON session cookie', () => {
	beforeEach(() => {
		__mockRolesGet.mockClear();
		__mockRolesGet.mockResolvedValue({
			ok: true,
			status: 200,
			data: { name: 'owner', level: 100 }
		});
	});

	it('parse được session cookie base64 JSON → locals.user có userId/roleId/roleName', async () => {
		const token = makeSessionToken({
			userId: 'users::abc123',
			username: 'admin',
			roleId: 'role-owner',
			issuedAt: Date.now()
		});

		const user = await getUserFromToken(token);

		expect(user).toBeDefined();
		expect(user!.username).toBe('admin');
		expect(user!.userId).toBe('users::abc123');
		expect(user!.roleId).toBe('role-owner');
		// roleName tra từ name_roles theo roleId — thay cho hardcode '.includes("owner")'
		expect(user!.roleName).toBe('owner');
		// Tra đúng documentKey
		expect(__mockRolesGet).toHaveBeenCalledWith({ documentKey: 'role-owner' });
	});

	it('từ chối session cũ hơn 30 ngày', async () => {
		const token = makeSessionToken({
			userId: 'users::abc123',
			username: 'admin',
			roleId: 'role-owner',
			issuedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 // 31 ngày
		});

		const user = await getUserFromToken(token);
		expect(user).toBeUndefined();
	});

	it('từ chối session thiếu issuedAt', async () => {
		const token = Buffer.from(
			JSON.stringify({ userId: 'users::abc', username: 'admin', roleId: 'role-owner' })
		).toString('base64');

		const user = await getUserFromToken(token);
		expect(user).toBeUndefined();
	});

	it('từ chối garbage token (không phải base64 JSON hợp lệ)', async () => {
		expect(await getUserFromToken('not-a-valid-token!!!')).toBeUndefined();
		expect(await getUserFromToken('')).toBeUndefined();
		expect(await getUserFromToken(Buffer.from('not json').toString('base64'))).toBeUndefined();
	});

	it('từ chối session thiếu trường bắt buộc (userId/username/roleId)', async () => {
		const missingUser = Buffer.from(JSON.stringify({ username: 'x', roleId: 'role-owner', issuedAt: Date.now() })).toString('base64');
		expect(await getUserFromToken(missingUser)).toBeUndefined();

		const missingRole = Buffer.from(JSON.stringify({ userId: 'users::a', username: 'x', issuedAt: Date.now() })).toString('base64');
		expect(await getUserFromToken(missingRole)).toBeUndefined();
	});

	it('vẫn trả user khi tra name_roles thất bại (roleName undefined — không crash)', async () => {
		__mockRolesGet.mockResolvedValue({ ok: false, status: 404, data: undefined });

		const token = makeSessionToken({
			userId: 'users::abc123',
			username: 'admin',
			roleId: 'role-unknown',
			issuedAt: Date.now()
		});

		const user = await getUserFromToken(token);
		// Session hợp lệ về mặt cấu trúc — vẫn xác thực được, chỉ thiếu roleName
		// (permission check riêng sẽ từ chối thao tác quản trị)
		expect(user).toBeDefined();
		expect(user!.userId).toBe('users::abc123');
		expect(user!.roleName).toBeUndefined();
	});
});
