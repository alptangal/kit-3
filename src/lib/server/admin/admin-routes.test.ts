// src/lib/server/admin/admin-routes.test.ts
//
// Route tests cho /api/admin/users/** — happy path + 403 thiếu quyền, theo đúng
// fetchSecure contract: request body mã hoá bằng public key server (mock decrypt),
// response mã hoá bằng public key phiên client (mock encrypt).
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// ── Encryption mocks — mock tại biên module như login.test.ts ──
vi.mock('$modules/encryption', () => ({
	encryption: {
		decryptWithPrivateKeyHybrid: vi.fn(),
		importPublicKey: vi.fn(),
		encryptWithPublicKeyHybrid: vi.fn(),
		hmacBlindIndex: vi.fn(),
		setupVault: vi.fn(),
		encryptData: vi.fn()
	}
}));

vi.mock('$store/initSystemVault', () => ({
	systemVault: {
		privateKey: {} as CryptoKey,
		publicKey: {} as CryptoKey,
		indexKey: new Uint8Array(32)
	}
}));

// ── Couchbase mocks ──
const mockQueryResponse = (ok: boolean, results: unknown[] = [], status: number = 200) => ({
	ok,
	status,
	data: ok ? { results } : undefined
});
const mockGetResponse = (ok: boolean, data?: unknown, status: number = 200) => ({
	ok,
	status,
	data
});

vi.mock('$modules/couchbase/clients', () => {
	const mk = () => ({
		create: vi.fn(),
		get: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		touch: vi.fn(),
		search: vi.fn(),
		query: vi.fn()
	});
	const mockUsers = mk();
	const mockRoles = mk();
	const mockUserStatus = mk();
	const mockDetailRoles = mk();

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
			if (collectionName === 'users') return createMockWithQuery(mockUsers);
			if (collectionName === 'name_roles') return createMockWithQuery(mockRoles);
			if (collectionName === 'user_status') return createMockWithQuery(mockUserStatus);
			if (collectionName === 'detail_roles') return createMockWithQuery(mockDetailRoles);
			return { document: { get: vi.fn(), create: vi.fn(), update: vi.fn(), query: vi.fn(), search: vi.fn() } };
		}),
		cbVault: vi.fn(() => createMockWithQuery(mockUsers)),
		__mockUsers: mockUsers,
		__mockRoles: mockRoles,
		__mockUserStatus: mockUserStatus,
		__mockDetailRoles: mockDetailRoles
	};
});

vi.mock('$env/static/private', () => ({
	cb_clusterId: 'cluster',
	cb_username: 'u',
	cb_password: 'p',
	cb_bucketName: 'bucket',
	cb_scopeName: 'scope',
	cb_clusterId_vault: 'cluster',
	cb_username_vault: 'u',
	cb_password_vault: 'p',
	cb_bucketName_vault: 'bucket',
	cb_scopeName_vault: 'scope',
	vault_password: 'vault-password',
	cb_collectionName_vault: 'system_secrets',
	email_owner: 'owner@example.com',
	password_owner: 'password123',
	username_owner: 'owner'
}));

const { encryption } = await import('$modules/encryption');
const { __mockUsers, __mockRoles, __mockDetailRoles } = await import('$modules/couchbase/clients');

// Import route handlers SAU khi mọi dependency đã mock
const listRoute = await import('$routes/api/admin/users/list/+server');
const createRoute = await import('$routes/api/admin/users/create/+server');

/** Request body mã hoá — decrypt trả đúng JSON mình muốn gửi. */
function mockEncryptedBody(payload: unknown) {
	vi.mocked(encryption.decryptWithPrivateKeyHybrid).mockResolvedValue(
		JSON.stringify({ publicKeyB64: 'session-pk-b64', ...payload })
	);
}

/** Response đã mã hoá — encrypt trả payload gốc để assert nội dung. */
function captureEncryptedResponse() {
	vi.mocked(encryption.encryptWithPublicKeyHybrid).mockImplementation(
		async (_pk: CryptoKey, plaintext: string) => ({ plaintext })
	);
	vi.mocked(encryption.importPublicKey).mockResolvedValue({} as CryptoKey);
}

/** Xây RequestEvent giả theo interface mà route handler dùng (locals, request, url). */
function makeEvent(localsUser: unknown) {
	return {
		locals: { user: localsUser },
		request: new Request('https://localhost/api/admin/users/list', {
			method: 'POST',
			headers: { 'accept-language': 'vi-VN,vi;q=0.9,en;q=0.8' },
			body: JSON.stringify({ fake: 'encrypted' })
		}),
		url: new URL('https://localhost/api/admin/users/list'),
		getClientAddress: () => '127.0.0.1',
		cookies: {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn()
		}
	} as any;
}

/** Lấy payload JSON đã "mã hoá" từ Response của route. */
async function responsePayload(response: Response) {
	const body = (await response.json()) as { plaintext: string };
	return JSON.parse(body.plaintext);
}

/** Session user hợp lệ — như hooks sẽ ghi vào locals sau khi parse cookie. */
const ownerSession = {
	username: 'admin',
	userId: 'users::owner-key',
	roleId: 'role-owner',
	roleName: 'owner'
};

describe('/api/admin/users/list', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEncryptedBody({ page: 1, pageSize: 20 });
		captureEncryptedResponse();

		// Owner có grant users:manage scope all
		__mockDetailRoles.query.mockResolvedValue(
			mockQueryResponse(true, [
				{ roleName: 'owner', permissionKey: 'users:manage', scope: 'all' }
			])
		);
		// list() chạy 2 query (count + data) trên users collection
		__mockUsers.query
			.mockResolvedValueOnce(mockQueryResponse(true, [3]))
			.mockResolvedValueOnce(
				mockQueryResponse(true, [
					{ _id: 'users::a', firstname: 'A' },
					{ _id: 'users::b', firstname: 'B' }
				])
			);
	});

	it('happy path — owner list users, trả items + total', async () => {
		const response = await listRoute.POST(makeEvent(ownerSession));
		expect(response.status).toBe(200);

		const payload = await responsePayload(response);
		expect(payload.ok).toBe(true);
		expect(payload.data.total).toBe(3);
		expect(payload.data.items).toHaveLength(2);
		// Message đã thu gọn về tiếng Việt theo accept-language
		expect(payload.message).toEqual({ vi: 'Lấy danh sách người dùng thành công' });
	});

	it('403 khi actor không có quyền users:manage (customer)', async () => {
		__mockDetailRoles.query.mockResolvedValue(mockQueryResponse(true, []));

		const customerSession = {
			username: 'guest',
			userId: 'users::customer-key',
			roleId: 'role-customer',
			roleName: 'customer'
		};
		const response = await listRoute.POST(makeEvent(customerSession));
		expect(response.status).toBe(403);

		const payload = await responsePayload(response);
		expect(payload.ok).toBe(false);
		expect(payload.message).toEqual({
			vi: 'Bạn không có quyền thực hiện thao tác này'
		});
	});

	it('401 khi session không hợp lệ (locals.user rỗng)', async () => {
		const response = await listRoute.POST(makeEvent(undefined));
		expect(response.status).toBe(401);

		const payload = await responsePayload(response);
		expect(payload.ok).toBe(false);
		expect(payload.message).toEqual({ vi: 'Phiên đăng nhập đã hết hạn' });
	});
});

describe('/api/admin/users/create', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		captureEncryptedResponse();

		__mockDetailRoles.query.mockResolvedValue(
			mockQueryResponse(true, [
				{ roleName: 'owner', permissionKey: 'users:manage', scope: 'all' }
			])
		);

		// Actor 'owner' tra level theo name; role mới ('role-staff') tra theo documentKey
		__mockRoles.search.mockResolvedValue(mockGetResponse(true, [{ level: 100 }]));
		__mockRoles.get.mockResolvedValue(mockGetResponse(true, { level: 10, name: 'staff' }));
		__mockUsers.get.mockResolvedValue(mockGetResponse(true, { branchId: 'branch-1' }));

		vi.mocked(encryption.hmacBlindIndex).mockResolvedValue('blind-index');
		vi.mocked(encryption.setupVault).mockResolvedValue({
			dek: {} as CryptoKey,
			storageRecord: { saltB64: 'salt', dekIvB64: 'iv', wrappedDekB64: 'wrapped' }
		});
		vi.mocked(encryption.encryptData).mockResolvedValue({ ivB64: 'iv', ciphertextB64: 'ct' } as any);
	});

	it('happy path — owner tạo user mới, trả 201 + documentKey', async () => {
		mockEncryptedBody({
			firstname: 'New',
			lastname: 'Staff',
			email: 'newstaff@example.com',
			phone: '0123456789',
			username: 'newstaff',
			password: 'password123',
			roleId: 'role-staff'
		});

		// Chưa trùng email/username, create thành công
		__mockUsers.search.mockResolvedValue(mockGetResponse(true, []));
		__mockUsers.create.mockResolvedValue({ ok: true, status: 201, data: { success: true } });

		const response = await createRoute.POST(makeEvent(ownerSession));
		expect(response.status).toBe(201);

		const payload = await responsePayload(response);
		expect(payload.ok).toBe(true);
		expect(payload.data.documentKey).toMatch(/^users::/);
	});

	it('403 khi actor không có quyền users:manage', async () => {
		__mockDetailRoles.query.mockResolvedValue(mockQueryResponse(true, []));
		mockEncryptedBody({
			firstname: 'New',
			email: 'newstaff@example.com',
			username: 'newstaff',
			password: 'password123',
			roleId: 'role-staff'
		});

		const customerSession = {
			username: 'guest',
			userId: 'users::customer-key',
			roleId: 'role-customer',
			roleName: 'customer'
		};
		const response = await createRoute.POST(makeEvent(customerSession));
		expect(response.status).toBe(403);
	});

	it('400 khi thiếu trường bắt buộc (không có email)', async () => {
		mockEncryptedBody({
			firstname: 'New',
			username: 'newstaff',
			password: 'password123',
			roleId: 'role-staff'
		});

		const response = await createRoute.POST(makeEvent(ownerSession));
		expect(response.status).toBe(400);

		const payload = await responsePayload(response);
		expect(payload.ok).toBe(false);
	});
});
