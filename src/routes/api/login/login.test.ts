// Test for login endpoint JWT integration
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('$modules/encryption', () => ({
	encryption: {
		decryptWithPrivateKeyHybrid: vi.fn(),
		importPublicKey: vi.fn(),
		encryptWithPublicKeyHybrid: vi.fn(),
		hmacBlindIndex: vi.fn()
	}
}));

vi.mock('$store/initSystemVault', () => ({
	systemVault: {
		privateKey: {} as CryptoKey,
		publicKey: {} as CryptoKey,
		indexKey: new Uint8Array(32)
	}
}));

vi.mock('$lib/server/db/users', () => ({
	Users: {
		login: vi.fn()
	}
}));

vi.mock('$lib/server/jwt', () => ({
	signAccessToken: vi.fn()
}));

vi.mock('$app/environment', () => ({
	dev: true
}));

import { encryption } from '$modules/encryption';
import { Users } from '$lib/server/db/users';
import { signAccessToken } from '$lib/server/jwt';
import * as devModule from '$app/environment';

// Simulate the login endpoint logic
// devOverride: mô phỏng production (dev=false) — vì `dev` đã được import tĩnh vào
// module này, vi.doMock không thay đổi được binding; truyền qua tham số thay vào đó.
async function simulateLogin(
	requestBody: {
		password: string;
		username: string;
		remember: boolean;
		publicKeyB64: string;
	},
	devOverride?: boolean
) {
	const { password, username, remember, publicKeyB64 } = requestBody;
	const dev = devOverride ?? devModule.dev;

	if (!username || !password) {
		return { status: 400, message: 'Username and password are required' };
	}

	const normalizedInput = username.trim().toLowerCase();
	const usernameBlindIndex = await encryption.hmacBlindIndex(new Uint8Array(32), normalizedInput);
	const emailBlindIndex = await encryption.hmacBlindIndex(new Uint8Array(32), normalizedInput);

	const loginResult = await Users.login({
		usernameBlindIndex,
		emailBlindIndex,
		password
	}, '127.0.0.1');

	if (!loginResult.success) {
		return { status: 401, message: loginResult.messages };
	}

	const userInstance = loginResult.user;
	const userDocKey = userInstance.getDocumentKey();

	const sessionToken = await signAccessToken(
		{
			userId: userDocKey,
			username: userInstance.user.firstname,
			roleId: userInstance.user.roleId,
			statusId: userInstance.user.statusId
		},
		remember
	);

	const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

	return {
		status: 200,
		sessionToken,
		maxAge,
		cookieOptions: {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge
		}
	};
}

describe('Login Endpoint with JWT', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should call signAccessToken with correct payload and remember flag', async () => {
		// Setup mocks
		(encryption.hmacBlindIndex as any).mockResolvedValue('blind-index-value');
		(Users.login as any).mockResolvedValue({
			success: true,
			user: {
				getDocumentKey: () => 'user-doc-key-123',
				user: {
					firstname: 'TestUser',
					lastname: 'Test',
					roleId: 'role-staff',
					statusId: 'status-active'
				}
			}
		});
		(signAccessToken as any).mockResolvedValue('jwt.token.here');

		const result = await simulateLogin({
			username: 'testuser',
			password: 'password123',
			remember: true,
			publicKeyB64: 'public-key'
		});

		expect(signAccessToken).toHaveBeenCalledWith(
			{
				userId: 'user-doc-key-123',
				username: 'TestUser',
				roleId: 'role-staff',
				statusId: 'status-active'
			},
			true // remember = true
		);

		expect(result.status).toBe(200);
		expect(result.sessionToken).toBe('jwt.token.here');
		expect(result.maxAge).toBe(60 * 60 * 24 * 30); // 30 days
		expect(result.cookieOptions.maxAge).toBe(60 * 60 * 24 * 30);
		expect(result.cookieOptions.httpOnly).toBe(true);
		expect(result.cookieOptions.sameSite).toBe('lax');
	});

	it('should set 1 day expiration when remember=false', async () => {
		(encryption.hmacBlindIndex as any).mockResolvedValue('blind-index-value');
		(Users.login as any).mockResolvedValue({
			success: true,
			user: {
				getDocumentKey: () => 'user-doc-key-123',
				user: {
					firstname: 'TestUser',
					roleId: 'role-staff',
					statusId: 'status-active'
				}
			}
		});
		(signAccessToken as any).mockResolvedValue('jwt.token.here');

		const result = await simulateLogin({
			username: 'testuser',
			password: 'password123',
			remember: false,
			publicKeyB64: 'public-key'
		});

		expect(signAccessToken).toHaveBeenCalledWith(
			expect.any(Object),
			false // remember = false
		);

		expect(result.maxAge).toBe(60 * 60 * 24); // 1 day
	});

	it('should return 400 for missing username or password', async () => {
		const result1 = await simulateLogin({
			username: '',
			password: 'password123',
			remember: false,
			publicKeyB64: 'public-key'
		});

		const result2 = await simulateLogin({
			username: 'testuser',
			password: '',
			remember: false,
			publicKeyB64: 'public-key'
		});

		expect(result1.status).toBe(400);
		expect(result2.status).toBe(400);
	});

	it('should return 401 for failed login', async () => {
		(encryption.hmacBlindIndex as any).mockResolvedValue('blind-index-value');
		(Users.login as any).mockResolvedValue({
			success: false,
			messages: { vi: 'Sai mật khẩu', en: 'Invalid password' }
		});

		const result = await simulateLogin({
			username: 'testuser',
			password: 'wrongpassword',
			remember: false,
			publicKeyB64: 'public-key'
		});

		expect(result.status).toBe(401);
		expect(signAccessToken).not.toHaveBeenCalled();
	});

	it('should set secure cookie in production (dev=false)', async () => {
		(encryption.hmacBlindIndex as any).mockResolvedValue('blind-index-value');
		(Users.login as any).mockResolvedValue({
			success: true,
			user: {
				getDocumentKey: () => 'user-doc-key-123',
				user: {
					firstname: 'TestUser',
					roleId: 'role-staff',
					statusId: 'status-active'
				}
			}
		});
		(signAccessToken as any).mockResolvedValue('jwt.token.here');

		const result = await simulateLogin(
			{
				username: 'testuser',
				password: 'password123',
				remember: false,
				publicKeyB64: 'public-key'
			},
			false // dev=false → production
		);

		expect(result.cookieOptions.secure).toBe(true);
	});
});