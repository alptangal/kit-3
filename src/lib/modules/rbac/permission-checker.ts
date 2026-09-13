// $modules/rbac/permission-checker.ts
import { cbData } from '$modules/couchbase/clients';
import { cb_bucketName, cb_scopeName } from '$env/static/private'; // SỬA: thêm import

export type PermissionScope = 'all' | 'own_branch' | 'own_records';
const detailRolesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`detail_roles\``;
export interface PermissionContext {
	/** branchId của actor (người thực hiện thao tác) */
	branchId?: string;
	/** branchId của đối tượng bị tác động (target) — dùng để so sánh khi scope = own_branch */
	targetBranchId?: string | null;
	/** userId của actor */
	actorUserId?: string;
	/** userId của target — dùng để so sánh khi scope = own_records */
	targetUserId?: string;
}

interface DetailRoleDoc {
	roleName: string;
	permissionKey: string;
	scope: PermissionScope;
}

const cbDetailRoles = cbData('detail_roles');

// Cache đơn giản trong bộ nhớ — bảng detail_roles/permissions ít thay đổi (chỉ đổi khi
// admin sửa RBAC qua UI), tránh phải query lại mỗi lần check quyền.
// TTL ngắn để thay đổi vẫn được áp dụng trong thời gian hợp lý mà không cần restart server.
const CACHE_TTL_MS = 60_000;
let grantsCache: { data: DetailRoleDoc[]; expiresAt: number } | null = null;

async function getAllGrants(): Promise<DetailRoleDoc[]> {
	if (grantsCache && grantsCache.expiresAt > Date.now()) {
		return grantsCache.data;
	}
	const res = await cbDetailRoles.document.query({
		statement: `SELECT roleName, permissionKey, scope FROM ${detailRolesKeyspace}`,
		readonly: true
	});
	// SỬA: nếu query lỗi, KHÔNG nên cache kết quả rỗng (sẽ khoá quyền cả phút dù lỗi tạm thời
	// do mạng/hết hạn token) — chỉ cache khi query thành công.
	if (!res.ok) {
		console.error('[PermissionChecker] getAllGrants query failed:', res.message ?? res.status);
		return grantsCache?.data ?? []; // fallback về cache cũ (nếu có) thay vì luôn rỗng
	}
	const data = res.ok ? ((res.data?.results ?? []) as DetailRoleDoc[]) : [];
	grantsCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
	return data;
}

/** Gọi hàm này ngay sau khi admin sửa detail_roles qua UI để tránh đọc cache cũ. */
export function invalidateGrantsCache(): void {
	grantsCache = null;
}

export class PermissionChecker {
	/** Trả về scope được cấp cho (roleName, permissionKey), hoặc null nếu không có quyền. */
	static async getScope(roleName: string, permissionKey: string): Promise<PermissionScope | null> {
		const grants = await getAllGrants();
		const grant = grants.find((g) => g.roleName === roleName && g.permissionKey === permissionKey);
		return grant?.scope ?? null;
	}

	/**
	 * Kiểm tra actor (theo roleName) có được phép thực hiện permissionKey trong context hiện tại.
	 * - scope 'all'         → luôn cho phép.
	 * - scope 'own_branch'  → yêu cầu context.branchId === context.targetBranchId.
	 * - scope 'own_records' → yêu cầu context.actorUserId === context.targetUserId.
	 */
	static async can(
		roleName: string,
		permissionKey: string,
		context: PermissionContext = {}
	): Promise<boolean> {
		const scope = await this.getScope(roleName, permissionKey);
		if (!scope) return false;

		if (scope === 'all') return true;

		if (scope === 'own_branch') {
			if (!context.branchId || !context.targetBranchId) return false;
			return context.branchId === context.targetBranchId;
		}

		if (scope === 'own_records') {
			if (!context.actorUserId || !context.targetUserId) return false;
			return context.actorUserId === context.targetUserId;
		}

		return false;
	}

	/** Giống can(), nhưng throw nếu không đủ quyền — tiện dùng ở đầu route/service. */
	static async assert(
		roleName: string,
		permissionKey: string,
		context?: PermissionContext
	): Promise<void> {
		const allowed = await this.can(roleName, permissionKey, context);
		if (!allowed) {
			throw new Error(
				`Permission denied: role "${roleName}" lacks "${permissionKey}" in given scope`
			);
		}
	}
}
