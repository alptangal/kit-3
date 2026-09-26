// src/lib/server/db/user-admin.hierarchy.test.ts
//
// Regression tests — khoá chặt guard assertCanManageTarget() trong UserAdminService:
// manager (level 50) KHÔNG được delete/restore/setRole/setStatus lên owner (level 100)
// hay manager khác cùng cấp (level 50), và không được thao tác lên chính mình.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { UserAdminService } from '$lib/server/db/users';
import type { ActorContext } from '$lib/server/db/users';

// ── Mock helpers ──
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

const createActorContext = (overrides: Partial<ActorContext> = {}): ActorContext => ({
	roleName: 'manager',
	userId: 'users::manager-key',
	branchId: 'branch-1',
	...overrides
});

// ── Couchbase mocks ──
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

	// KHÔNG dùng getter cho query — vitest proxy hoá mock factory return làm getter
	// trả sai giá trị (bài học từ user-admin.race-condition.test.ts). dataApi cần
	// (a) document.query({...}) là hàm, (b) query.document.search namespace.
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

vi.mock('$store/initSystemVault', () => ({
	systemVault: {
		indexKey: new Uint8Array(32)
	}
}));

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
	email_owner: 'owner@example.com',
	password_owner: 'password123',
	username_owner: 'owner'
}));

const { __mockUsers, __mockRoles, __mockUserStatus, __mockDetailRoles } = await import(
	'$modules/couchbase/clients'
);

/** Làm mock document.get cho users trả về 1 target user theo roleId/branchId cho trước. */
function mockTargetUser(roleId: string, opts: { deletedAt?: string | null; documentKey?: string } = {}) {
	__mockUsers.get.mockResolvedValue(
		mockGetResponse(true, {
			firstname: 'Target',
			lastname: 'User',
			roleId,
			statusId: 'status-active',
			branchId: 'branch-1',
			emailBlindIndex: 'email-blind',
			usernameBlindIndex: 'username-blind',
			phoneBlindIndex: 'phone-blind',
			deletedAt: opts.deletedAt ?? null
		})
	);
}

describe('UserAdminService hierarchy guards (assertCanManageTarget)', () => {
	beforeAll(async () => {
		await import('$lib/server/db/users');
	});

	afterAll(() => {
		vi.resetModules();
	});

	beforeEach(() => {
		vi.clearAllMocks();

		// Target user mặc định cho các test override sau
		__mockUsers.get.mockResolvedValue(mockGetResponse(true, {}));
		__mockUsers.update.mockResolvedValue(mockGetResponse(true, {}));
		__mockUsers.search.mockResolvedValue(mockSearchResponse(true, []));
		__mockUsers.query.mockResolvedValue(mockQueryResponse(true, []));

		// Manager có grant 'users:manage' scope own_branch — qua được requirePermission
		__mockDetailRoles.query.mockResolvedValue(
			mockQueryResponse(true, [
				{ roleName: 'owner', permissionKey: 'users:manage', scope: 'all' },
				{ roleName: 'manager', permissionKey: 'users:manage', scope: 'own_branch' }
			])
		);

		// Level của các role: manager tra theo name, target tra theo documentKey roleId
		// 'role-owner' → 100, 'role-manager' → 50, 'role-staff' → 10
	});

	// Helper — cấu hình level lookup cho name_roles
	function setRoleLookup(byName: Record<string, number>, byKey: Record<string, number>) {
		__mockRoles.search.mockImplementation(async ({ conditions }: any) => {
			const cond = conditions?.[0];
			if (cond?.fieldName === 'name') {
				const level = byName[cond.keyword];
				return mockSearchResponse(true, level !== undefined ? [{ level }] : []);
			}
			return mockSearchResponse(true, []);
		});
		__mockRoles.get.mockImplementation(async ({ documentKey }: any) => {
			const level = byKey[documentKey];
			return mockGetResponse(level !== undefined, level !== undefined ? { level } : undefined);
		});
	}

	const standardLevels = () =>
		setRoleLookup(
			{ owner: 100, manager: 50, staff: 10, customer: 0 },
			{ 'role-owner': 100, 'role-manager': 50, 'role-staff': 10, 'role-customer': 0 }
		);

	it('manager KHÔNG được delete owner (level 100 > 50)', async () => {
		standardLevels();
		mockTargetUser('role-owner');
		const actor = createActorContext({ roleName: 'manager', userId: 'users::manager-key' });

		const result = await UserAdminService.delete(actor, 'users::owner-key');
		expect(result.success).toBe(false);
		expect(result.messages).toEqual({ vi: 'Bạn không có quyền thực hiện thao tác này', en: 'You do not have permission to perform this action' });
		// Không bao giờ gọi update — chặn từ trước khi ghi DB
		expect(__mockUsers.update).not.toHaveBeenCalled();
	});

	it('manager KHÔNG được delete manager khác cùng cấp (level bằng nhau)', async () => {
		standardLevels();
		mockTargetUser('role-manager', { documentKey: 'users::manager-2' });
		const actor = createActorContext({ roleName: 'manager', userId: 'users::manager-1' });

		const result = await UserAdminService.delete(actor, 'users::manager-2');
		expect(result.success).toBe(false);
		expect(__mockUsers.update).not.toHaveBeenCalled();
	});

	it('manager KHÔNG được thao tác lên chính mình (delete chính mình)', async () => {
		standardLevels();
		mockTargetUser('role-manager', { documentKey: 'users::manager-1' });
		const actor = createActorContext({ roleName: 'manager', userId: 'users::manager-1' });

		const result = await UserAdminService.delete(actor, 'users::manager-1');
		expect(result.success).toBe(false);
		expect(__mockUsers.update).not.toHaveBeenCalled();
	});

	it('manager KHÔNG được restore owner', async () => {
		standardLevels();
		mockTargetUser('role-owner', { deletedAt: '2026-01-01T00:00:00.000Z' });
		const actor = createActorContext({ roleName: 'manager' });

		const result = await UserAdminService.restore(actor, 'users::owner-key');
		expect(result.success).toBe(false);
		expect(__mockUsers.update).not.toHaveBeenCalled();
	});

	it('manager KHÔNG được setRole owner thành cao hơn (set role-owner cho staff)', async () => {
		standardLevels();
		// target staff level 10 — thấp hơn manager, nên qua được hierarchy guard,
		// nhưng roleId mới ('role-owner') có level 100 >= 50 → phải bị chặn ở setRole
		mockTargetUser('role-staff');
		const actor = createActorContext({ roleName: 'manager' });

		const result = await UserAdminService.setRole(actor, 'users::staff-key', 'role-owner');
		expect(result.success).toBe(false);
		expect(__mockUsers.update).not.toHaveBeenCalled();
	});

	it('manager KHÔNG được setStatus owner', async () => {
		standardLevels();
		mockTargetUser('role-owner');
		__mockUserStatus.get.mockResolvedValue(mockGetResponse(true, { canLogin: false }));
		const actor = createActorContext({ roleName: 'manager' });

		const result = await UserAdminService.setStatus(actor, 'users::owner-key', 'status-banned');
		expect(result.success).toBe(false);
		expect(__mockUsers.update).not.toHaveBeenCalled();
	});

	it('manager ĐƯỢC setStatus staff cùng chi nhánh (luôn downhill)', async () => {
		standardLevels();
		mockTargetUser('role-staff');
		__mockUserStatus.get.mockResolvedValue(mockGetResponse(true, { canLogin: false, name: 'banned' }));
		const actor = createActorContext({ roleName: 'manager' });

		const result = await UserAdminService.setStatus(actor, 'users::staff-key', 'status-banned');
		expect(result.success).toBe(true);
		expect(__mockUsers.update).toHaveBeenCalled();
	});

	it('owner ĐƯỢC delete manager (downhill, scope all)', async () => {
		standardLevels();
		mockTargetUser('role-manager');
		const actor = createActorContext({ roleName: 'owner', userId: 'users::owner-key' });

		const result = await UserAdminService.delete(actor, 'users::manager-2');
		expect(result.success).toBe(true);
		expect(__mockUsers.update).toHaveBeenCalled();
	});
});
