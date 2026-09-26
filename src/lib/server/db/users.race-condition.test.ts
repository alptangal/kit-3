import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';
import { encryption } from '$modules/encryption';
import { Users } from '$lib/server/db/users';
import type { User } from '$modules/schema';

// Mock Couchbase client responses
const mockCreateResponse = (ok: boolean, status: number = 201, message?: string) => ({
	ok,
	status,
	message,
	data: ok ? { success: true } : undefined
});

const mockGetResponse = (ok: boolean, data?: unknown, status: number = 200) => ({
	ok,
	status,
	data
});

const mockUpdateResponse = (ok: boolean, status: number = 200, message?: string) => ({
	ok,
	status,
	message
});

// Test user data generator
function createTestUser(overrides: Partial<User> = {}): User {
	const baseEmail = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
	const baseUsername = `user${Date.now()}${Math.random().toString(36).slice(2)}`;

	return {
		firstname: 'Test',
		midname: null,
		lastname: 'User',
		description: '',
		roleId: 'role-customer',
		statusId: 'status-active',

		emailBlindIndex: '',
		emailEncrypted: '{}',
		phoneBlindIndex: '',
		phoneEncrypted: '{}',
		usernameBlindIndex: '',
		profileEncrypted: '{}',

		vaultSaltB64: 'salt',
		vaultDekIvB64: 'iv',
		vaultWrappedDekB64: 'wrapped',

		authMethod: 'password',
		webauthnCredentials: [],
		webauthnUserHandle: crypto.randomUUID(),

		mfaEnabled: false,
		lastLoginAt: null,
		lastLoginIp: null,
		remember: false,

		branchId: null,

		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,

		...overrides
	};
}

// Mock the couchbase client before importing Users
vi.mock('$modules/couchbase/clients', () => {
	const mockDocument = {
		create: vi.fn(),
		get: vi.fn(),
		update: vi.fn(),
		query: vi.fn()
	};

	return {
		cbData: vi.fn(() => ({
			document: mockDocument
		})),
		cbVault: vi.fn(() => ({
			document: mockDocument
		})),
		__mockDocument: mockDocument
	};
});

describe('Users.save() race condition fix', () => {
	let mockDocument: any;

	beforeAll(async () => {
		// Get the mocked document client
		const { __mockDocument } = await import('$modules/couchbase/clients');
		mockDocument = __mockDocument;
	});

	afterAll(() => {
		vi.resetModules();
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should create user with deterministic documentKey based on emailBlindIndex', async () => {
		const userData = createTestUser();
		const emailBlindIndex = 'dGVzdEBleGFtcGxlLmNvbQ=='; // base64 of 'test@example.com'
		const usernameBlindIndex = 'dXNlcm5hbWU='; // base64 of 'username'

		userData.emailBlindIndex = emailBlindIndex;
		userData.usernameBlindIndex = usernameBlindIndex;

		// Mock successful create
		mockDocument.create.mockResolvedValue(mockCreateResponse(true));

		const usersInstance = new Users(userData);
		const result = await usersInstance.save();

		expect(result.success).toBe(true);
		expect(mockDocument.create).toHaveBeenCalledTimes(1);

		// Verify documentKey is deterministic and based on emailBlindIndex
		const callArgs = mockDocument.create.mock.calls[0][0];
		expect(callArgs.documentKey).toBe(`users::dGVzdEBleGFtcGxlLmNvbQ`);
		expect(usersInstance.getDocumentKey()).toBe(`users::dGVzdEBleGFtcGxlLmNvbQ`);
	});

	it('should handle 409 conflict when email already exists (race condition)', async () => {
		const userData = createTestUser();
		const emailBlindIndex = 'dGVzdEBleGFtcGxlLmNvbQ==';
		const usernameBlindIndex = 'dXNlcm5hbWU=';

		userData.emailBlindIndex = emailBlindIndex;
		userData.usernameBlindIndex = usernameBlindIndex;

		// Mock conflict response (409)
		mockDocument.create.mockResolvedValue(mockCreateResponse(false, 409, 'Document already exists'));
		// Mock isEmailTaken to return true for conflict scenario
		vi.spyOn(Users, 'isEmailTaken').mockResolvedValue(true);
		vi.spyOn(Users, 'isUsernameTaken').mockResolvedValue(false);

		const usersInstance = new Users(userData);
		const result = await usersInstance.save();

		expect(result.success).toBe(false);
		expect(result.messages).toEqual(
			expect.objectContaining({
				vi: 'Email đã được sử dụng',
				en: 'Email is already in use'
			})
		);
	});

	it('should handle 409 conflict when username already exists', async () => {
		const userData = createTestUser();
		const emailBlindIndex = 'dGVzdEBleGFtcGxlLmNvbQ==';
		const usernameBlindIndex = 'dXNlcm5hbWU=';

		userData.emailBlindIndex = emailBlindIndex;
		userData.usernameBlindIndex = usernameBlindIndex;

		// Mock conflict response (409)
		mockDocument.create.mockResolvedValue(mockCreateResponse(false, 409, 'Document already exists'));
		// Mock isUsernameTaken to return true
		vi.spyOn(Users, 'isEmailTaken').mockResolvedValue(false);
		vi.spyOn(Users, 'isUsernameTaken').mockResolvedValue(true);

		const usersInstance = new Users(userData);
		const result = await usersInstance.save();

		expect(result.success).toBe(false);
		expect(result.messages).toEqual(
			expect.objectContaining({
				vi: 'Tên đăng nhập đã được sử dụng',
				en: 'Username is already in use'
			})
		);
	});

	it('should use documentKey for updates when documentKey exists', async () => {
		const userData = createTestUser();
		const existingDocKey = 'users::existing-key';
		const emailBlindIndex = 'dGVzdEBleGFtcGxlLmNvbQ==';

		userData.emailBlindIndex = emailBlindIndex;

		mockDocument.update.mockResolvedValue(mockUpdateResponse(true));

		const usersInstance = new Users(userData, existingDocKey);
		const result = await usersInstance.save();

		expect(result.success).toBe(true);
		expect(mockDocument.update).toHaveBeenCalledTimes(1);
		expect(mockDocument.create).not.toHaveBeenCalled();

		const callArgs = mockDocument.update.mock.calls[0][0];
		expect(callArgs.documentKey).toBe(existingDocKey);
		expect(callArgs.content.updatedAt).toBeDefined();
	});

	it('should encode documentKey to base64url (handle +, /, =)', async () => {
		// Test various base64 characters that need encoding
		const testCases = [
			{ input: 'YQ==', expected: 'YQ' }, // padding
			{ input: 'YWI=', expected: 'YWI' }, // padding
			{ input: 'YWFh', expected: 'YWFh' }, // no special chars
			{ input: 'aGVsbG8vd29ybGQ=', expected: 'aGVsbG8vd29ybGQ' }, // forward slash
			{ input: 'aGVsbG8rd29ybGQ=', expected: 'aGVsbG8rd29ybGQ' }, // plus sign
			{ input: 'YWJjZGVmZ2hpamtsbW5vcA==', expected: 'YWJjZGVmZ2hpamtsbW5vcA' } // complex
		];

		for (const { input, expected } of testCases) {
			const encoded = Users.encodeDocumentKey(input);
			expect(encoded).toBe(expected);
		}
	});

	it('should make documentKey from emailBlindIndex', async () => {
		const emailBlindIndex = 'dGVzdEBleGFtcGxlLmNvbQ=='; // base64
		const documentKey = Users.makeDocumentKey(emailBlindIndex);
		expect(documentKey).toBe('users::dGVzdEBleGFtcGxlLmNvbQ');
	});

	it('should throw TranslatableError when user data not initialized', async () => {
		const usersInstance = new Users(null as any);
		await expect(usersInstance.save()).rejects.toThrow();
	});

	it('should simulate concurrent registration race condition', async () => {
		// Simulate two concurrent requests trying to register same email
		const userData1 = createTestUser();
		const userData2 = createTestUser();
		const emailBlindIndex = 'dGVzdEBleGFtcGxlLmNvbQ==';
		const usernameBlindIndex = 'dXNlcm5hbWU=';

		userData1.emailBlindIndex = emailBlindIndex;
		userData1.usernameBlindIndex = usernameBlindIndex;
		userData2.emailBlindIndex = emailBlindIndex;
		userData2.usernameBlindIndex = usernameBlindIndex;

		// First request succeeds
		mockDocument.create
			.mockResolvedValueOnce(mockCreateResponse(true))
			// Second request gets 409 conflict
			.mockResolvedValueOnce(mockCreateResponse(false, 409));

		vi.spyOn(Users, 'isEmailTaken').mockResolvedValue(true);
		vi.spyOn(Users, 'isUsernameTaken').mockResolvedValue(false);

		const users1 = new Users(userData1);
		const users2 = new Users(userData2);

		const [result1, result2] = await Promise.all([
			users1.save(),
			users2.save()
		]);

		// One should succeed, one should fail with email taken
		const successCount = [result1, result2].filter(r => r.success).length;
		const emailTakenCount = [result1, result2].filter(
			r => !r.success && r.messages?.vi === 'Email đã được sử dụng'
		).length;

		expect(successCount).toBe(1);
		expect(emailTakenCount).toBe(1);
	});
});