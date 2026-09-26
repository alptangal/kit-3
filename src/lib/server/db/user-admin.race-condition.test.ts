import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';
import { encryption } from '$modules/encryption';
import { UserAdminService } from '$lib/server/db/users';
import type { ActorContext } from '$lib/server/db/users';

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

const mockSearchResponse = (ok: boolean, data?: unknown, status: number = 200) => ({
	ok,
	status,
	data
});

const mockQueryResponse = (ok: boolean, results: unknown[] = [], status: number = 200) => ({
	ok,
	status,
	data: ok ? { results } : undefined
});

// Test actor context
const createActorContext = (overrides: Partial<ActorContext> = {}): ActorContext => ({
	roleName: 'owner',
	userId: 'users::admin-key',
	branchId: 'branch-1',
	...overrides
});

// Create shared mock objects inside the factory
vi.mock('$modules/couchbase/clients', () => {
	const mockDocumentCreate = {
		create: vi.fn(),
		get: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		touch: vi.fn(),
		search: vi.fn(),
		query: vi.fn()
	};
	const mockRolesCreate = {
		create: vi.fn(),
		get: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		touch: vi.fn(),
		search: vi.fn(),
		query: vi.fn()
	};
	const mockUserStatusCreate = {
		create: vi.fn(),
		get: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		touch: vi.fn(),
		search: vi.fn(),
		query: vi.fn()
	};
	const mockDetailRolesCreate = {
		create: vi.fn(),
		get: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		touch: vi.fn(),
		search: vi.fn(),
		query: vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			data: {
				results: [
					{ roleName: 'owner', permissionKey: 'users:manage', scope: 'all' },
					{ roleName: 'manager', permissionKey: 'users:manage', scope: 'own_branch' }
				]
			}
		})
	};

	// KHÔNG dùng getter cho query — vitest proxy hoá mock factory return làm getter
	// trả sai giá trị. Master's dataApi cần cả: (a) document.query({...}) là hàm
	// (N1QL, trả res.data.results), (b) query.document.search namespace.
	const createMockWithQuery = (docMethods: any) => ({
		...docMethods,
		document: {
			...docMethods,
			query: docMethods.query
		},
		query: {
			collection: {
				create: vi.fn(),
				drop: vi.fn(),
				list: vi.fn()
			},
			document: {
				search: docMethods.search || vi.fn()
			}
		}
	});

	return {
		cbData: vi.fn((collectionName: string) => {
			if (collectionName === 'users') return createMockWithQuery(mockDocumentCreate);
			if (collectionName === 'name_roles') return createMockWithQuery(mockRolesCreate);
			if (collectionName === 'user_status') return createMockWithQuery(mockUserStatusCreate);
			if (collectionName === 'detail_roles') return createMockWithQuery(mockDetailRolesCreate);
			return { document: { get: vi.fn(), create: vi.fn(), update: vi.fn(), query: vi.fn(), search: vi.fn() } };
		}),
		cbVault: vi.fn(() => createMockWithQuery(mockDocumentCreate)),
		__mockDocumentCreate: mockDocumentCreate,
		__mockRolesCreate: mockRolesCreate,
		__mockUserStatusCreate: mockUserStatusCreate,
		__mockDetailRolesCreate: mockDetailRolesCreate
	};
});

vi.mock('$store/initSystemVault', () => ({
	systemVault: {
		indexKey: new Uint8Array(32)
	}
}));

// Import the mocks
const {
	__mockDocumentCreate,
	__mockRolesCreate,
	__mockUserStatusCreate,
	__mockDetailRolesCreate
} = await import('$modules/couchbase/clients');

describe('UserAdminService.createUser() race condition fix', () => {
	beforeAll(async () => {
		// Force module reload
		await import('$lib/server/db/users');
	});

	afterAll(() => {
		vi.resetModules();
	});

	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock responses
		__mockDocumentCreate.create.mockResolvedValue(mockCreateResponse(true));
		__mockDocumentCreate.get.mockResolvedValue(mockGetResponse(false));
		__mockDocumentCreate.update.mockResolvedValue(mockCreateResponse(true));
		__mockDocumentCreate.query.mockResolvedValue({ ok: true, data: { results: [] } });
		__mockDocumentCreate.search.mockResolvedValue(mockSearchResponse(true, []));

		__mockRolesCreate.get.mockResolvedValue(mockGetResponse(true, { level: 10, name: 'customer' }));
		__mockRolesCreate.search.mockResolvedValue(mockSearchResponse(true, [{ level: 100, name: 'owner' }]));

		__mockUserStatusCreate.get.mockResolvedValue(mockGetResponse(true, { canLogin: true }));
		__mockUserStatusCreate.search.mockResolvedValue(mockSearchResponse(true, []));

		__mockDetailRolesCreate.query.mockResolvedValue(mockQueryResponse(true, [
			{ roleName: 'owner', permissionKey: 'users:manage', scope: 'all' },
			{ roleName: 'manager', permissionKey: 'users:manage', scope: 'own_branch' }
		]));
		__mockDetailRolesCreate.search.mockResolvedValue(mockSearchResponse(true, []));

		// Mock encryption functions
		vi.spyOn(encryption, 'hmacBlindIndex').mockImplementation(async (key: Uint8Array, value: string) => {
			// Simple deterministic hash for testing
			const encoder = new TextEncoder();
			const data = encoder.encode(value.trim().toLowerCase());
			const hashBuffer = await crypto.subtle.digest('SHA-256', data);
			const hashArray = new Uint8Array(hashBuffer);
			return btoa(String.fromCharCode(...hashArray));
		});

		vi.spyOn(encryption, 'setupVault').mockResolvedValue({
			dek: {} as any,
			storageRecord: {
				saltB64: 'salt',
				dekIvB64: 'iv',
				wrappedDekB64: 'wrapped'
			}
		});

		vi.spyOn(encryption, 'encryptData').mockResolvedValue({
			ivB64: 'iv',
			ciphertextB64: 'ciphertext'
		});
	});

	it('should create user with deterministic documentKey based on emailBlindIndex', async () => {
		const actor = createActorContext();
		const userData = {
			firstname: 'New',
			lastname: 'User',
			email: 'newuser@example.com',
			phone: '0123456789',
			username: 'newuser',
			password: 'password123',
			roleId: 'role-customer',
			statusId: 'status-active',
			branchId: 'branch-1'
		};

		const result = await UserAdminService.createUser(actor, userData);

		expect(result.success).toBe(true);
		expect(result.documentKey).toBeDefined();
		expect(result.documentKey).toMatch(/^users::/);
		expect(__mockDocumentCreate.create).toHaveBeenCalledTimes(1);

		const callArgs = __mockDocumentCreate.create.mock.calls[0][0];
		expect(callArgs.documentKey).toBe(result.documentKey);
	});

	it('should handle 409 conflict when email already exists', async () => {
		const actor = createActorContext();
		const userData = {
			firstname: 'New',
			lastname: 'User',
			email: 'existing@example.com',
			phone: '0123456789',
			username: 'newuser',
			password: 'password123',
			roleId: 'role-customer',
			statusId: 'status-active',
			branchId: 'branch-1'
		};

		// Mock conflict on create
		__mockDocumentCreate.create.mockResolvedValue(mockCreateResponse(false, 409));

		// Mock isEmailTaken to return true (conflict detected)
		const { Users } = await import('$lib/server/db/users');
		vi.spyOn(Users, 'isEmailTaken').mockResolvedValue(true);
		vi.spyOn(Users, 'isUsernameTaken').mockResolvedValue(false);

		const result = await UserAdminService.createUser(actor, userData);

		expect(result.success).toBe(false);
		expect(result.messages).toEqual(
			expect.objectContaining({
				vi: 'Email đã được sử dụng',
				en: 'Email is already in use'
			})
		);
	});

	it('should handle 409 conflict when username already exists', async () => {
		const actor = createActorContext();
		const userData = {
			firstname: 'New',
			lastname: 'User',
			email: 'new@example.com',
			phone: '0123456789',
			username: 'existinguser',
			password: 'password123',
			roleId: 'role-customer',
			statusId: 'status-active',
			branchId: 'branch-1'
		};

		// Mock conflict on create
		__mockDocumentCreate.create.mockResolvedValue(mockCreateResponse(false, 409));

		const { Users } = await import('$lib/server/db/users');
		vi.spyOn(Users, 'isEmailTaken').mockResolvedValue(false);
		vi.spyOn(Users, 'isUsernameTaken').mockResolvedValue(true);

		const result = await UserAdminService.createUser(actor, userData);

		expect(result.success).toBe(false);
		expect(result.messages).toEqual(
			expect.objectContaining({
				vi: 'Tên đăng nhập đã được sử dụng',
				en: 'Username is already in use'
			})
		);
	});

	it('should simulate concurrent admin user creation race condition', async () => {
		const actor = createActorContext();
		const userData1 = {
			firstname: 'User',
			lastname: 'One',
			email: 'race@example.com',
			phone: '0123456789',
			username: 'raceuser1',
			password: 'password123',
			roleId: 'role-customer',
			statusId: 'status-active',
			branchId: 'branch-1'
		};
		const userData2 = {
			firstname: 'User',
			lastname: 'Two',
			email: 'race@example.com', // Same email
			phone: '0987654321',
			username: 'raceuser2',
			password: 'password123',
			roleId: 'role-customer',
			statusId: 'status-active',
			branchId: 'branch-1'
		};

		// First succeeds, second gets 409
		__mockDocumentCreate.create
			.mockResolvedValueOnce(mockCreateResponse(true))
			.mockResolvedValueOnce(mockCreateResponse(false, 409));

		// Master flow: isEmailTaken/isUsernameTaken chạy TRƯỚC create. Cả 2 request đồng
		// thời đều thấy "chưa taken" (race), request 1 create thành công, request 2 nhận 409
		// từ create() thì tra lại blind index để trả emailTaken chính xác.
		// Thứ tự call isEmailTaken: req1-precheck(false), req2-precheck(false), req2-recheck(true).
		const { Users } = await import('$lib/server/db/users');
		vi.spyOn(Users, 'isEmailTaken')
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		vi.spyOn(Users, 'isUsernameTaken').mockResolvedValue(false);

		const [result1, result2] = await Promise.all([
			UserAdminService.createUser(actor, userData1),
			UserAdminService.createUser(actor, userData2)
		]);

		const successCount = [result1, result2].filter(r => r.success).length;
		const emailTakenCount = [result1, result2].filter(
			r => !r.success && r.messages?.vi === 'Email đã được sử dụng'
		).length;

		expect(successCount).toBe(1);
		expect(emailTakenCount).toBe(1);
	});

	it('should require actor to have higher role level than target', async () => {
		const actor = createActorContext({ roleName: 'manager' }); // level 50
		const userData = {
			firstname: 'New',
			lastname: 'User',
			email: 'new@example.com',
			phone: '0123456789',
			username: 'newuser',
			password: 'password123',
			roleId: 'role-owner', // level 100 - higher than actor!
			statusId: 'status-active',
			branchId: 'branch-1'
		};

		__mockRolesCreate.get
			.mockResolvedValueOnce(mockGetResponse(true, { level: 50, name: 'manager' })) // actor level
			.mockResolvedValueOnce(mockGetResponse(true, { level: 100, name: 'owner' })); // target role level

		__mockRolesCreate.search
			.mockResolvedValueOnce(mockSearchResponse(true, [{ level: 50, name: 'manager' }]))
			.mockResolvedValueOnce(mockSearchResponse(true, [{ level: 100, name: 'owner' }]));

		const result = await UserAdminService.createUser(actor, userData);

		expect(result.success).toBe(false);
		expect(result.messages).toEqual(
			expect.objectContaining({
				vi: 'Bạn không có quyền thực hiện thao tác này',
				en: 'You do not have permission to perform this action'
			})
		);
	});
});