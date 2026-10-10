// $lib/server/db/customers.ts
// CustomerAdminService — các thao tác QUẢN TRỢ trên khách hàng (users với roleId='role-customer')
// Hoạt động trên collection 'users' + SAFE fields của users.ts
// KHÔNG trả username/email/vault/blind index — blind index architecture

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/products';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { customers as customerMessages } from '../messages/db';
import { Users, adminMessages, authMessages } from './users';
import type { AdminSafeField } from './users';

const cbUsers = cbData('users');
const cbUserStatus = cbData('user_status');

const usersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`users\``;

const adminMsg = {
	notFound: customerMessages.notFound,
	queryFailed: customerMessages.queryFailed,
	createFailed: customerMessages.createFailed,
	updateFailed: customerMessages.updateFailed,
	deleteFailed: customerMessages.deleteFailed,
	permissionDenied: customerMessages.permissionDenied,
	statusNotFound: customerMessages.statusNotFound,
	invalidStatus: customerMessages.invalidStatus,
	statusUpdated: customerMessages.statusUpdated,
	vaultUninitialized: customerMessages.vaultUninitialized
} as const;

// SAFE fields giống users.ts ADMIN_SAFE_FIELDS — KHÔNG bao gồm vault*, blind index, webauthn*
const CUSTOMER_ADMIN_SAFE_FIELDS = [
	'firstname',
	'midname',
	'lastname',
	'description',
	'roleId',
	'statusId',
	'emailEncrypted',
	'phoneEncrypted',
	'profileEncrypted',
	'authMethod',
	'mfaEnabled',
	'lastLoginAt',
	'remember',
	'customerTierEncrypted',
	'loyaltyPoints',
	'branchId',
	'createdAt',
	'updatedAt',
	'deletedAt'
] as const;

type CustomerSafeField = (typeof CUSTOMER_ADMIN_SAFE_FIELDS)[number];

interface CustomerDocument {
	_id: string;
	firstname?: string | null;
	midname?: string | null;
	lastname?: string | null;
	description?: string | null;
	roleId: string;
	statusId: string;
	emailEncrypted?: string;
	phoneEncrypted?: string;
	profileEncrypted?: string;
	authMethod?: string;
	mfaEnabled?: boolean;
	lastLoginAt?: string | null;
	remember?: boolean;
	customerTierEncrypted?: string;
	loyaltyPoints?: number;
	branchId?: string | null;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string | null;
}

interface CustomerAdminListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

interface CustomerStatsResult {
	totalCustomers: number;
	todayCustomers: number;
	activeCustomers: number;
	statusBreakdown: Record<string, number>;
}

function sanitizeCustomerForAdmin(doc: CustomerDocument): Record<string, unknown> {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of CUSTOMER_ADMIN_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	return safe;
}

export class CustomerAdminService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string,
		targetBranchId?: string | null,
		targetUserId?: string
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			targetBranchId,
			actorUserId: actor.userId,
			targetUserId
		});
		if (!allowed) return { success: false, messages: adminMsg.permissionDenied };
		return null;
	}

	// Valid statuses for customers
	private static readonly VALID_STATUSES = ['status-active', 'status-suspended', 'status-banned', 'status-pending_verification'];

	private static isValidStatus(statusId: string): boolean {
		return this.VALID_STATUSES.includes(statusId);
	}

	static async list(
		actor: ActorContext,
		options: {
			page?: number;
			pageSize?: number;
			includeDeleted?: boolean;
			search?: string;
			statusId?: string;
			branchId?: string;
		} = {}
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & CustomerAdminListResult)> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'users:manage');
		if (!scope) return { success: false, messages: adminMsg.permissionDenied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: (string | number)[] = [];

		// Chỉ lấy user có roleId = 'role-customer'
		args.push('role-customer');
		conditions.push(`roleId = $${args.length}`);

		if (scope === 'own_branch') {
			if (!actor.branchId) {
				return { success: false, messages: adminMsg.permissionDenied };
			}
			args.push(actor.branchId);
			conditions.push(`branchId = $${args.length}`);
		} else if (scope === 'own_records') {
			args.push(actor.userId);
			conditions.push(`META().id = $${args.length}`);
		}

		if (!options.includeDeleted) {
			conditions.push('(deletedAt IS NULL OR deletedAt IS MISSING)');
		}

		if (options.search) {
			args.push(`%${options.search}%`);
			// Search trên firstname/lastname/description (không có email/username plaintext)
			conditions.push(`(firstname LIKE $${args.length} OR lastname LIKE $${args.length} OR description LIKE $${args.length})`);
		}

		if (options.statusId) {
			args.push(options.statusId);
			conditions.push(`statusId = $${args.length}`);
		}

		if (options.branchId) {
			args.push(options.branchId);
			conditions.push(`branchId = $${args.length}`);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = `META().id AS _id, ${CUSTOMER_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')}`;

		const [countRes, dataRes] = await Promise.all([
			cbUsers.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${usersKeyspace} ${whereClause}`,
				args,
				readonly: true
			}),
			cbUsers.document.query({
				statement: `SELECT ${selectClause} FROM ${usersKeyspace} ${whereClause} ORDER BY createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
				args,
				readonly: true
			})
		]);

		if (!countRes.ok || !dataRes.ok) {
			return { success: false, messages: adminMsg.queryFailed };
		}

		const total = Number(countRes.data?.results?.[0] ?? 0);
		const items = (dataRes.data?.results ?? []).map(sanitizeCustomerForAdmin);

		return { success: true, items, total, page, pageSize };
	}

	static async getById(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: false; messages: TranslateContent } | { success: true; data: Record<string, unknown> }> {
		const denied = await this.requirePermission(actor, 'users:manage', null, documentKey);
		if (denied) return denied;

		const res = await cbUsers.document.get({ documentKey });
		if (!res.ok || !res.data) {
			return { success: false, messages: adminMsg.notFound };
		}

		const user = res.data as CustomerDocument;
		if (user.roleId !== 'role-customer') {
			return { success: false, messages: adminMsg.notFound };
		}

		return { success: true, data: sanitizeCustomerForAdmin({ ...user, _id: documentKey }) };
	}

	static async update(
		actor: ActorContext,
		documentKey: string,
		data: {
			firstname?: string;
			midname?: string | null;
			lastname?: string | null;
			description?: string;
			branchId?: string | null;
		}
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbUsers.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMsg.notFound };

		const user = target.data as CustomerDocument;
		if (user.roleId !== 'role-customer') {
			return { success: false, messages: adminMsg.notFound };
		}

		const denied = await this.requirePermission(actor, 'users:manage', user.branchId ?? null, documentKey);
		if (denied) return denied;

		// Check hierarchy (actor level > target level)
		const hierarchyDenied = await this.assertCanManageTarget(actor, user);
		if (hierarchyDenied) return hierarchyDenied;

		if (user.deletedAt) {
			return { success: false, messages: adminMessages.userAlreadyDeleted };
		}

		const updatePayload: Partial<CustomerDocument> = { updatedAt: new Date().toISOString() };
		if (data.firstname !== undefined) updatePayload.firstname = data.firstname;
		if (data.midname !== undefined) updatePayload.midname = data.midname;
		if (data.lastname !== undefined) updatePayload.lastname = data.lastname;
		if (data.description !== undefined) updatePayload.description = data.description;
		if (data.branchId !== undefined) updatePayload.branchId = data.branchId;

		try {
			const res = await cbUsers.document.update({ documentKey, content: updatePayload as CustomerDocument });
			if (!res.ok) return { success: false, messages: adminMsg.updateFailed };
			return { success: true, messages: { vi: 'Cập nhật khách hàng thành công', en: 'Customer updated successfully' } };
		} catch {
			return { success: false, messages: adminMsg.updateFailed };
		}
	}

	static async setStatus(
		actor: ActorContext,
		documentKey: string,
		statusId: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbUsers.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMsg.notFound };

		const user = target.data as CustomerDocument;
		if (user.roleId !== 'role-customer') {
			return { success: false, messages: adminMsg.notFound };
		}

		const denied = await this.requirePermission(actor, 'users:manage', user.branchId ?? null, documentKey);
		if (denied) return denied;

		const hierarchyDenied = await this.assertCanManageTarget(actor, user);
		if (hierarchyDenied) return hierarchyDenied;

		if (user.deletedAt) {
			return { success: false, messages: adminMessages.userAlreadyDeleted };
		}

		if (!this.isValidStatus(statusId)) {
			return { success: false, messages: adminMsg.invalidStatus };
		}

		// Validate status exists in catalog
		const status = await cbUserStatus.document.get({ documentKey: statusId });
		if (!status.ok || !status.data) {
			return { success: false, messages: adminMsg.statusNotFound };
		}

		try {
			const res = await cbUsers.document.update({
				documentKey,
				content: { statusId, updatedAt: new Date().toISOString() } as Partial<CustomerDocument> as CustomerDocument
			});
			if (!res.ok) return { success: false, messages: adminMsg.updateFailed };
			return { success: true, messages: adminMsg.statusUpdated };
		} catch {
			return { success: false, messages: adminMsg.updateFailed };
		}
	}

	static async delete(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbUsers.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMsg.notFound };

		const user = target.data as CustomerDocument;
		if (user.roleId !== 'role-customer') {
			return { success: false, messages: adminMsg.notFound };
		}

		const denied = await this.requirePermission(actor, 'users:manage', user.branchId ?? null, documentKey);
		if (denied) return denied;

		const hierarchyDenied = await this.assertCanManageTarget(actor, user);
		if (hierarchyDenied) return hierarchyDenied;

		if (user.deletedAt) {
			return { success: false, messages: adminMessages.userAlreadyDeleted };
		}

		// Soft delete
		try {
			const res = await cbUsers.document.update({
				documentKey,
				content: { deletedAt: new Date().toISOString(), statusId: 'status-suspended' } as Partial<CustomerDocument> as CustomerDocument
			});
			if (!res.ok) return { success: false, messages: adminMsg.deleteFailed };
			return { success: true, messages: { vi: 'Xoá khách hàng thành công', en: 'Customer deleted successfully' } };
		} catch {
			return { success: false, messages: adminMsg.deleteFailed };
		}
	}

	static async getStats(
		actor: ActorContext
	): Promise<{ success: false; messages: TranslateContent } | { success: true; data: CustomerStatsResult }> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'users:manage');
		if (!scope) return { success: false, messages: adminMsg.permissionDenied };

		// Điều kiện dùng chung: chỉ đếm user role-customer chưa xoá, thu hẹp theo
		// scope. Mỗi query tự nối WHERE cho đúng bộ args (bản cũ trộn 2 style build
		// WHERE — chuỗi replace/gián tiếp dễ sai khi thiếu điều kiện).
		const baseConditions: string[] = ['roleId = $1'];
		const baseArgs: (string | number)[] = ['role-customer'];

		if (scope === 'own_branch') {
			if (!actor.branchId) {
				return { success: false, messages: adminMsg.permissionDenied };
			}
			baseArgs.push(actor.branchId);
			baseConditions.push(`branchId = $${baseArgs.length}`);
		} else if (scope === 'own_records') {
			baseArgs.push(actor.userId);
			baseConditions.push(`META().id = $${baseArgs.length}`);
		}

		// Filter "chưa xoá" cho mọi count
		const notDeleted = ['(deletedAt IS NULL OR deletedAt IS MISSING)'];
		const buildWhere = (extraConditions: string[], args: (string | number)[]) => {
			const all = [...baseConditions, ...notDeleted, ...extraConditions];
			return `WHERE ${all.join(' AND ')}`;
		};

		try {
			// Total customers
			const totalRes = await cbUsers.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${usersKeyspace} ${buildWhere([], baseArgs)}`,
				args: baseArgs,
				readonly: true
			});

			// Today customers — createdAt >= đầu hôm nay
			const todayArgs = [...baseArgs, new Date().toISOString().slice(0, 10)];
			const todayRes = await cbUsers.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${usersKeyspace} ${buildWhere([`createdAt >= $${todayArgs.length}`], todayArgs)}`,
				args: todayArgs,
				readonly: true
			});

			// Active customers
			const activeArgs = [...baseArgs, 'status-active'];
			const activeRes = await cbUsers.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${usersKeyspace} ${buildWhere([`statusId = $${activeArgs.length}`], activeArgs)}`,
				args: activeArgs,
				readonly: true
			});

			// Status breakdown — N1QL: không dùng RAW khi SELECT nhiều biểu thức
			const statusRes = await cbUsers.document.query({
				statement: `SELECT statusId, COUNT(*) AS count FROM ${usersKeyspace} ${buildWhere([], baseArgs)} GROUP BY statusId`,
				args: baseArgs,
				readonly: true
			});

			if (!totalRes.ok || !todayRes.ok || !activeRes.ok || !statusRes.ok) {
				return { success: false, messages: adminMsg.queryFailed };
			}

			const totalCustomers = Number(totalRes.data?.results?.[0] ?? 0);
			const todayCustomers = Number(todayRes.data?.results?.[0] ?? 0);
			const activeCustomers = Number(activeRes.data?.results?.[0] ?? 0);

			const statusBreakdown: Record<string, number> = {};
			for (const row of statusRes.data?.results ?? []) {
				const r = row as { statusId: string; count: number };
				statusBreakdown[r.statusId] = r.count;
			}

			return { success: true, data: { totalCustomers, todayCustomers, activeCustomers, statusBreakdown } };
		} catch {
			return { success: false, messages: adminMsg.queryFailed };
		}
	}

	private static async assertCanManageTarget(
		actor: ActorContext,
		targetUser: CustomerDocument
	): Promise<{ success: false; messages: TranslateContent } | null> {
		// Actor không được thao tác lên chính mình
		const targetDocKey = targetUser._id;
		if (targetDocKey === actor.userId) {
			return { success: false, messages: adminMsg.permissionDenied };
		}

		// Actor level > target level
		const [actorLevel, targetLevel] = await Promise.all([
			this.getRoleLevelByName(actor.roleName),
			this.getRoleLevelById(targetUser.roleId)
		]);

		if (actorLevel === null || targetLevel === null || actorLevel <= targetLevel) {
			return { success: false, messages: adminMsg.permissionDenied };
		}
		return null;
	}

	private static async getRoleLevelByName(roleName: string): Promise<number | null> {
		const cbRoles = cbData('name_roles');
		const res = await cbRoles.query.document.search({
			conditions: [{ fieldName: 'name', keyword: roleName }],
			limit: 1
		});
		if (!res.ok || !res.data || res.data.length === 0) return null;
		const level = (res.data[0] as { level?: number }).level;
		return typeof level === 'number' ? level : null;
	}

	private static async getRoleLevelById(roleId: string): Promise<number | null> {
		const cbRoles = cbData('name_roles');
		const res = await cbRoles.document.get({ documentKey: roleId });
		if (!res.ok || !res.data) return null;
		const level = (res.data as { level?: number }).level;
		return typeof level === 'number' ? level : null;
	}
}