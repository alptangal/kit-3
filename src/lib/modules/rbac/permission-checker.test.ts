// src/lib/modules/rbac/permission-checker.test.ts
//
// Regression test — khoá bug "reserved word scope": getAllGrants() từng dùng
// `SELECT roleName, permissionKey, scope FROM ...`, nhưng 'scope' là từ khoá
// reserved trong N1QL → query luôn fail 400 → mọi role mất toàn bộ quyền mà
// không có lỗi rõ ràng (fallback []). Fix: SELECT * rồi unwrap row lồng
// theo tên collection ({ detail_roles: {...} }).
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Row Couchbase trả về cho `SELECT * FROM ...detail_roles` — bọc trong object
// keyed theo tên collection.
const grantRow = (roleName: string, permissionKey: string, scope: string) => ({
	detail_roles: { roleName, permissionKey, scope, createdAt: '2026-08-21T00:00:00.000Z' }
});

const mockQuery = vi.fn();

vi.mock('$modules/couchbase/clients', () => ({
	cbData: vi.fn(() => ({
		document: { query: (...args: unknown[]) => mockQuery(...args) }
	}))
}));

vi.mock('$env/static/private', () => ({ cb_bucketName: 'b', cb_scopeName: 's' }));

const { PermissionChecker, invalidateGrantsCache } = await import('./permission-checker');

describe('PermissionChecker — getAllGrants qua SELECT * (reserved word scope)', () => {
	beforeEach(() => {
		mockQuery.mockReset();
		// Cache 60s — invalidateGrantsCache() là API công khai để ép query lại
		invalidateGrantsCache();
	});

	it('query SELECT * — không dùng cột "scope" trần (reserved word N1QL)', async () => {
		mockQuery.mockResolvedValue({ ok: true, status: 200, data: { results: [] } });
		await PermissionChecker.can('owner', 'users:manage', {});
		const statement = mockQuery.mock.calls[0][0].statement as string;
		expect(statement).toContain('SELECT *');
		expect(statement).not.toMatch(/SELECT[^]*[^\\`]scope[^a-zA-Z]/);
	});

	it('unwrap row lồng { detail_roles: {...} } và cấp quyền scope all', async () => {
		mockQuery.mockResolvedValue({
			ok: true,
			status: 200,
			data: { results: [grantRow('owner', 'users:manage', 'all')] }
		});
		expect(await PermissionChecker.can('owner', 'users:manage', {})).toBe(true);
	});

	it('tôn trọng scope own_branch — chỉ cho khi branch khớp', async () => {
		mockQuery.mockResolvedValue({
			ok: true,
			status: 200,
			data: { results: [grantRow('manager', 'users:manage', 'own_branch')] }
		});
		expect(await PermissionChecker.can('manager', 'users:manage', { branchId: 'b1', targetBranchId: 'b1' })).toBe(true);
		expect(await PermissionChecker.can('manager', 'users:manage', { branchId: 'b1', targetBranchId: 'b2' })).toBe(false);
		expect(await PermissionChecker.can('manager', 'users:manage', {})).toBe(false);
	});

	it('từ chối khi không có grant cho role/permission', async () => {
		mockQuery.mockResolvedValue({
			ok: true,
			status: 200,
			data: { results: [grantRow('customer', 'orders:read', 'own_records')] }
		});
		expect(await PermissionChecker.can('customer', 'users:manage', {})).toBe(false);
	});

	it('query fail → fallback không cache rỗng vĩnh viễn, retry vẫn query lại', async () => {
		mockQuery.mockResolvedValueOnce({ ok: false, status: 400, message: 'syntax error' });
		expect(await PermissionChecker.can('owner', 'users:manage', {})).toBe(false);
		// Lần sau vẫn phải query lại (không cache kết quả lỗi)
		mockQuery.mockResolvedValueOnce({
			ok: true,
			status: 200,
			data: { results: [grantRow('owner', 'users:manage', 'all')] }
		});
		expect(await PermissionChecker.can('owner', 'users:manage', {})).toBe(true);
		expect(mockQuery).toHaveBeenCalledTimes(2);
	});
});
