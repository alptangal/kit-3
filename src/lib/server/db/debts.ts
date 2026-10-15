// $lib/server/db/debts.ts
// DebtService — quản lí công nợ 2 chiều:
//   receivable (phải thu — khách hàng, từ đơn bán chịu/ghi nợ)
//   payable    (phải trả — nhà cung cấp, từ phiếu nhập hàng chịu)
//
// Mỗi khoản nợ = 1 doc trong collection `debts`; mỗi lần trả = 1 doc trong
// `debt_payments` + cập nhật paidAmount/remainingAmount/status trên debts.
// Ghi nhận trả dùng UPDATE điều kiện theo paidAmount cũ (chống race — pattern
// deductStock transfers.ts: Data API trả results=[] nhưng metrics.mutationCount=1
// khi thành công; mutationCount=0 nghĩa là có người ghi nhận trước → race fail).
//
// Schema: src/lib/modules/schema.ts `debts`, `debt_payments`.

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import type { ActorContext } from './users';
import { broadcastDbChange } from '../db-broadcast';

const cbDebts = cbData('debts');
const cbDebtPayments = cbData('debt_payments');
// Customers lưu trong collection 'users' (pattern customers.ts) — dùng cbUsers
// để verify party + lấy tên denormalize.
const cbUsers = cbData('users');
const cbSuppliers = cbData('suppliers');

const debtsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`debts\``;
const debtPaymentsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`debt_payments\``;
const suppliersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`suppliers\``;

const adminMessages = {
	notFound: {
		vi: 'Không tìm thấy khoản nợ',
		en: 'Debt not found'
	} as TranslateContent,
	paymentNotFound: {
		vi: 'Không tìm thấy lịch sử thanh toán',
		en: 'Debt payment not found'
	} as TranslateContent,
	queryFailed: {
		vi: 'Truy vấn thất bại',
		en: 'Query failed'
	} as TranslateContent,
	createFailed: {
		vi: 'Tạo khoản nợ thất bại',
		en: 'Failed to create debt'
	} as TranslateContent,
	paymentFailed: {
		vi: 'Ghi nhận thanh toán thất bại',
		en: 'Failed to record payment'
	} as TranslateContent,
	deleteFailed: {
		vi: 'Xóa khoản nợ thất bại',
		en: 'Failed to delete debt'
	} as TranslateContent,
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	} as TranslateContent,
	invalidAmount: {
		vi: 'Số tiền không hợp lệ',
		en: 'Invalid amount'
	} as TranslateContent,
	invalidParty: {
		vi: 'Khách hàng hoặc nhà cung cấp không hợp lệ',
		en: 'Invalid customer or supplier'
	} as TranslateContent,
	invalidDebtType: {
		vi: 'Loại công nợ không hợp lệ',
		en: 'Invalid debt type'
	} as TranslateContent,
	invalidMethod: {
		vi: 'Phương thức thanh toán không hợp lệ',
		en: 'Invalid payment method'
	} as TranslateContent,
	alreadySettled: {
		vi: 'Khoản nợ đã được thanh toán đủ',
		en: 'Debt is already settled'
	} as TranslateContent,
	hasPayments: {
		vi: 'Khoản nợ đã có lịch sử thanh toán, không thể xóa',
		en: 'Debt has payment history and cannot be deleted'
	} as TranslateContent,
	raceConflict: {
		vi: 'Khoản nợ vừa được cập nhật bởi người khác, vui lòng thử lại',
		en: 'Debt was just updated by someone else, please retry'
	} as TranslateContent
} as const;

const DEBT_ADMIN_SAFE_FIELDS = [
	'debtCode',
	'type',
	'partyType',
	'partyId',
	'partyName',
	'referenceType',
	'referenceId',
	'referenceCode',
	'amount',
	'paidAmount',
	'remainingAmount',
	'dueDate',
	'status',
	'branchId',
	'notes',
	'createdBy',
	'settledAt',
	'createdAt',
	'updatedAt'
] as const;

const PAYMENT_ADMIN_SAFE_FIELDS = [
	'debtId',
	'debtCode',
	'amount',
	'method',
	'paidAt',
	'receivedBy',
	'notes',
	'branchId',
	'createdAt'
] as const;

const VALID_DEBT_TYPES = ['receivable', 'payable'] as const;
type DebtType = (typeof VALID_DEBT_TYPES)[number];

const VALID_PARTY_TYPES = ['customer', 'supplier'] as const;

const VALID_METHODS = ['cash', 'bank_transfer', 'card', 'other'] as const;

const VALID_STATUSES = ['open', 'partial', 'settled', 'overdue'] as const;

function sanitizeDebtForAdmin(doc: any & { _id: string }) {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of DEBT_ADMIN_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	return safe;
}

function sanitizePaymentForAdmin(doc: any & { _id: string }) {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of PAYMENT_ADMIN_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	return safe;
}

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

function statusForPaid(amount: number, paidAmount: number): string {
	if (paidAmount >= amount - 1e-9) return 'settled';
	if (paidAmount > 0) return 'partial';
	return 'open';
}

interface DebtListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

export class DebtService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string,
		targetBranchId?: string | null
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			targetBranchId,
			actorUserId: actor.userId
		});
		if (!allowed) return { success: false, messages: adminMessages.permissionDenied };
		return null;
	}

	/**
	 * List debts (phân trang + filter type/party/status/branch).
	 * Scope own_branch: chỉ thấy khoản nợ của chi nhánh mình.
	 */
	static async list(
		actor: ActorContext,
		options: {
			type?: string;
			partyType?: string;
			status?: string;
			branchId?: string;
			page?: number;
			pageSize?: number;
		} = {}
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & DebtListResult)> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'debts:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: (string | number)[] = [];

		if (scope === 'own_branch') {
			if (!actor.branchId) return { success: false, messages: adminMessages.permissionDenied };
			conditions.push('branchId = $' + (args.length + 1));
			args.push(actor.branchId);
		}

		if (options.type) {
			conditions.push('type = $' + (args.length + 1));
			args.push(options.type);
		}

		if (options.partyType) {
			conditions.push('partyType = $' + (args.length + 1));
			args.push(options.partyType);
		}

		if (options.status) {
			conditions.push('status = $' + (args.length + 1));
			args.push(options.status);
		}

		if (options.branchId) {
			conditions.push('branchId = $' + (args.length + 1));
			args.push(options.branchId);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = 'META().id AS _id, ' + DEBT_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

		const [countRes, dataRes] = await Promise.all([
			cbDebts.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${debtsKeyspace} ${whereClause}`,
				args,
				readonly: true
			}),
			cbDebts.document.query({
				statement: `SELECT ${selectClause} FROM ${debtsKeyspace} ${whereClause} ORDER BY createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
				args,
				readonly: true
			})
		]);

		if (!countRes.ok || !dataRes.ok) {
			return { success: false, messages: adminMessages.queryFailed };
		}

		const total = Number(countRes.data?.results?.[0] ?? 0);
		const items = (dataRes.data?.results ?? []).map(sanitizeDebtForAdmin);

		return { success: true, items, total, page, pageSize };
	}

	/**
	 * Tổng hợp số dư công nợ 1 chiều (summary cards):
	 * totalOutstanding (còn nợ), totalPaid (đã trả), overdueCount, openCount.
	 * Status 'overdue' là trạng thái hiển thị (dueDate < hôm nay && chưa settled) —
	 * service giữ status gốc trong doc, summary tính overdue theo dueDate.
	 */
	static async summary(
		actor: ActorContext,
		options: { type?: string; branchId?: string } = {}
	): Promise<
		| { success: false; messages: TranslateContent }
		| ({ success: true } & {
				totalOutstanding: number;
				totalPaid: number;
				overdueCount: number;
				openCount: number;
		  })
	> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'debts:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const conditions: string[] = [];
		const args: (string | number)[] = [];

		if (scope === 'own_branch') {
			if (!actor.branchId) return { success: false, messages: adminMessages.permissionDenied };
			conditions.push('branchId = $' + (args.length + 1));
			args.push(actor.branchId);
		}

		if (options.type) {
			conditions.push('type = $' + (args.length + 1));
			args.push(options.type);
		}

		if (options.branchId) {
			conditions.push('branchId = $' + (args.length + 1));
			args.push(options.branchId);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		// So sánh dueDate qua tham số (ISO string so sánh lexicographic đúng) —
		// tránh NOW_STR() vì Data API có thể không hỗ trợ hàm này.
		const todayIso = new Date().toISOString();
		args.push(todayIso);
		const nowParam = '$' + args.length;

		const res = await cbDebts.document.query({
			statement: `
				SELECT
					SUM(CASE WHEN status != 'settled' THEN remainingAmount ELSE 0 END) AS totalOutstanding,
					SUM(paidAmount) AS totalPaid,
					SUM(CASE WHEN status != 'settled' AND dueDate IS NOT MISSING AND dueDate IS NOT NULL AND dueDate < ${nowParam} THEN 1 ELSE 0 END) AS overdueCount,
					SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS openCount
				FROM ${debtsKeyspace} ${whereClause}
			`,
			args,
			readonly: true
		});

		if (!res.ok) return { success: false, messages: adminMessages.queryFailed };

		const row = (res.data?.results ?? [])[0] as
			| { totalOutstanding?: number | null; totalPaid?: number | null; overdueCount?: number | null; openCount?: number | null }
			| undefined;

		return {
			success: true,
			totalOutstanding: round2(Number(row?.totalOutstanding ?? 0)),
			totalPaid: round2(Number(row?.totalPaid ?? 0)),
			overdueCount: Number(row?.overdueCount ?? 0),
			openCount: Number(row?.openCount ?? 0)
		};
	}

	/**
	 * Get 1 debt + lịch sử thanh toán (mới nhất trước).
	 * Own_branch chỉ thấy khoản của chi nhánh mình.
	 */
	static async get(
		actor: ActorContext,
		debtId: string
	): Promise<
		| { success: false; messages: TranslateContent }
		| ({ success: true } & { debt: Record<string, unknown>; payments: Record<string, unknown>[] })
	> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'debts:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const res = await cbDebts.document.get({ documentKey: debtId });
		if (!res.ok) return { success: false, messages: adminMessages.notFound };

		const debt = (res as any).data as Record<string, unknown>;

		if (scope === 'own_branch' && debt.branchId !== actor.branchId) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		const payRes = await cbDebtPayments.document.query({
			statement: `SELECT META().id AS _id, ${PAYMENT_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')} FROM ${debtPaymentsKeyspace} WHERE debtId = $1 ORDER BY paidAt DESC`,
			args: [debtId],
			readonly: true
		});
		const payments = payRes.ok ? (payRes.data?.results ?? []).map(sanitizePaymentForAdmin) : [];

		return { success: true, debt: sanitizeDebtForAdmin({ ...debt, _id: debtId }), payments };
	}

	/**
	 * List payment history (toàn hệ thống, filter theo debt/type/branch) — dùng cho
	 * tab lịch sử thanh toán.
	 */
	static async listPayments(
		actor: ActorContext,
		options: {
			debtId?: string;
			type?: string;
			branchId?: string;
			page?: number;
			pageSize?: number;
		} = {}
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & DebtListResult)> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'debts:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		// debt_payments denormalize branchId từ debt khi tạo (recordPayment gắn
		// branchId của debt) nên filter payments trực tiếp, không cần JOIN debts.
		// (type filter theo thuộc tính debt cha: UI truyền debtId cụ thể khi cần.)
		const conditions: string[] = [];
		const args: (string | number)[] = [];

		if (scope === 'own_branch') {
			conditions.push('branchId = $' + (args.length + 1));
			args.push(actor.branchId ?? '');
		}
		if (options.debtId) {
			conditions.push('debtId = $' + (args.length + 1));
			args.push(options.debtId);
		}
		if (options.branchId) {
			conditions.push('branchId = $' + (args.length + 1));
			args.push(options.branchId);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = 'META().id AS _id, ' + PAYMENT_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

		const [countRes, dataRes] = await Promise.all([
			cbDebtPayments.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${debtPaymentsKeyspace} ${whereClause}`,
				args,
				readonly: true
			}),
			cbDebtPayments.document.query({
				statement: `SELECT ${selectClause} FROM ${debtPaymentsKeyspace} ${whereClause} ORDER BY createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
				args,
				readonly: true
			})
		]);

		if (!countRes.ok || !dataRes.ok) {
			return { success: false, messages: adminMessages.queryFailed };
		}

		const total = Number(countRes.data?.results?.[0] ?? 0);
		const items = (dataRes.data?.results ?? []).map(sanitizePaymentForAdmin);

		return { success: true, items, total, page, pageSize };
	}

	/**
	 * Tạo khoản nợ thủ công (API tạo tay — auto-tạo từ order/PO chịu là ngoài scope).
	 * - type receivable → partyType bắt buộc 'customer'; payable → 'supplier'.
	 * - Verify party tồn tại (customers/suppliers) + denormalize tên.
	 * - code DR-YYYYMMDD-XXXX (receivable) / DP-YYYYMMDD-XXXX (payable).
	 */
	static async create(
		actor: ActorContext,
		data: {
			type: string;
			partyId: string;
			amount: number;
			dueDate?: string | null;
			referenceType?: string | null;
			referenceId?: string | null;
			referenceCode?: string | null;
			notes?: string | null;
		}
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { debt: Record<string, unknown> })> {
		// Quyền tạo: debts:manage trên chi nhánh của actor
		const permError = await this.requirePermission(actor, 'debts:manage', actor.branchId ?? null);
		if (permError) return permError;

		if (!(VALID_DEBT_TYPES as readonly string[]).includes(data.type)) {
			return { success: false, messages: adminMessages.invalidDebtType };
		}

		const amount = Number(data.amount);
		if (!Number.isFinite(amount) || amount <= 0) {
			return { success: false, messages: adminMessages.invalidAmount };
		}

		const expectedPartyType: string = data.type === 'receivable' ? 'customer' : 'supplier';
		if (!data.partyId) return { success: false, messages: adminMessages.invalidParty };

		// Verify party tồn tại + lấy tên denormalize
		let partyName: string;
		if (expectedPartyType === 'customer') {
			const res = await cbUsers.document.get({ documentKey: data.partyId });
			if (!res.ok) return { success: false, messages: adminMessages.invalidParty };
			const doc = (res as any).data as Record<string, unknown>;
			partyName = [doc.firstname, doc.lastname].filter(Boolean).join(' ').trim() || 'Khách hàng';
		} else {
			const res = await cbSuppliers.document.get({ documentKey: data.partyId });
			if (!res.ok) return { success: false, messages: adminMessages.invalidParty };
			const doc = (res as any).data as Record<string, unknown>;
			partyName = String(doc.name ?? '').trim() || 'Nhà cung cấp';
		}

		const debtId = `debt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
		const now = new Date().toISOString();
		const datePart = now.slice(0, 10).replace(/-/g, '');
		const debtCode = `${data.type === 'receivable' ? 'DR' : 'DP'}-${datePart}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

		const debt = {
			debtCode,
			type: data.type,
			partyType: expectedPartyType,
			partyId: data.partyId,
			partyName,
			referenceType: data.referenceType ?? null,
			referenceId: data.referenceId ?? null,
			referenceCode: data.referenceCode ?? null,
			amount: round2(amount),
			paidAmount: 0,
			remainingAmount: round2(amount),
			dueDate: data.dueDate ?? null,
			status: 'open' as const,
			// InferCollection<'debts'> yêu cầu branchId: string (required) — actor luôn
			// có branchId khi qua getActorContext; fallback chuỗi rỗng thay vì null.
			branchId: actor.branchId ?? '',
			notes: data.notes ?? null,
			createdBy: actor.userId,
			settledAt: null,
			createdAt: now,
			updatedAt: now
		};

		const createRes = await cbDebts.document.create({
			documentKey: debtId,
			content: debt
		});
		if (!createRes.ok) {
			return { success: false, messages: adminMessages.createFailed };
		}

		void broadcastDbChange({ collection: 'debts', action: 'create', by: actor.userId });

		return { success: true, debt: sanitizeDebtForAdmin({ ...debt, _id: debtId }) };
	}

	/**
	 * Ghi nhận 1 lần trả (AR: thu tiền khách; AP: trả tiền NCC).
	 * Atomic: tạo payment doc + UPDATE điều kiện debts theo paidAmount cũ
	 * (chống race 2 nhân viên ghi nhận cùng lúc). Chỉ cho trả trên khoản chưa settled.
	 */
	static async recordPayment(
		actor: ActorContext,
		debtId: string,
		data: { amount: number; method: string; paidAt?: string | null; notes?: string | null }
	): Promise<
		| { success: false; messages: TranslateContent }
		| ({ success: true } & { debt: Record<string, unknown>; payment: Record<string, unknown> })
	> {
		const loaded = await this.loadDebt(debtId);
		if (!loaded.ok) return { success: false, messages: adminMessages.notFound };
		const debt = loaded.debt;

		const permError = await this.requirePermission(actor, 'debts:manage', (debt.branchId as string) ?? null);
		if (permError) return permError;

		const scope = await PermissionChecker.getScope(actor.roleName, 'debts:manage');
		if (scope === 'own_branch' && debt.branchId !== actor.branchId) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		const amount = Number(data.amount);
		if (!Number.isFinite(amount) || amount <= 0) {
			return { success: false, messages: adminMessages.invalidAmount };
		}

		if (!(VALID_METHODS as readonly string[]).includes(data.method)) {
			return { success: false, messages: adminMessages.invalidMethod };
		}

		if (String(debt.status) === 'settled') {
			return { success: false, messages: adminMessages.alreadySettled };
		}

		const currentPaid = round2(Number(debt.paidAmount ?? 0));
		const debtAmount = Number(debt.amount ?? 0);
		const newPaid = round2(currentPaid + amount);
		if (newPaid > debtAmount + 1e-9) {
			return { success: false, messages: adminMessages.invalidAmount };
		}

		const paymentId = `debt_payment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
		const now = new Date().toISOString();
		const paidAt = data.paidAt ?? now;

		const payment = {
			debtId,
			debtCode: debt.debtCode ?? null,
			amount: round2(amount),
			method: data.method,
			paidAt,
			receivedBy: actor.userId,
			notes: data.notes ?? null,
			branchId: debt.branchId ?? actor.branchId ?? null,
			createdAt: now
		};

		const createRes = await cbDebtPayments.document.create({
			documentKey: paymentId,
			content: payment
		});
		if (!createRes.ok) {
			return { success: false, messages: adminMessages.paymentFailed };
		}

		// UPDATE điều kiện theo paidAmount cũ — atomic chống race:
		// 2 request đồng thời đọc cùng paidAmount → chỉ 1 mutationCount=1 thành công.
		// settledAt: chỉ set khi chuyển settled, giữ nguyên (NULLIF giả) khi chưa.
		const newStatus = statusForPaid(debtAmount, newPaid);
		const settledSetExpr = newStatus === 'settled' ? '$6' : 'settledAt';
		const updateRes = await cbDebts.document.query({
			statement: `
				UPDATE ${debtsKeyspace}
				SET paidAmount = $3, remainingAmount = $4, status = $5,
				    settledAt = ${settledSetExpr}, updatedAt = $6
				WHERE META().id = $1 AND paidAmount = $2
			`,
			args: [debtId, currentPaid, newPaid, round2(debtAmount - newPaid), newStatus, now],
			readonly: false
		});
		if (!updateRes.ok) {
			return { success: false, messages: adminMessages.raceConflict };
		}
		const mutationCount = Number((updateRes.data as any)?.metrics?.mutationCount ?? 1);
		if (mutationCount === 0) {
			// Ai đó đã ghi nhận trước → race conflict, payment doc đã tạo nhưng
			// debt chưa cập nhật — xoá payment vừa tạo để không mất tiền "ảo".
			await cbDebtPayments.document.delete({ documentKey: paymentId });
			return { success: false, messages: adminMessages.raceConflict };
		}

		void broadcastDbChange({ collection: 'debts', action: 'update', by: actor.userId });
		void broadcastDbChange({ collection: 'debt_payments', action: 'create', by: actor.userId });

		// Đọc lại debt sau update để trả dữ liệu chính xác
		const refreshed = await this.loadDebt(debtId);
		const freshDebt = refreshed.ok ? refreshed.debt : { ...debt, paidAmount: newPaid, remainingAmount: round2(debtAmount - newPaid), status: newStatus, settledAt: newStatus === 'settled' ? now : null };

		return {
			success: true,
			debt: sanitizeDebtForAdmin({ ...freshDebt, _id: debtId }),
			payment: sanitizePaymentForAdmin({ ...payment, _id: paymentId })
		};
	}

	/**
	 * Xóa khoản nợ — chỉ khi chưa có payment nào (giữ audit sạch).
	 */
	static async delete(
		actor: ActorContext,
		debtId: string
	): Promise<{ success: false; messages: TranslateContent } | { success: true }> {
		const loaded = await this.loadDebt(debtId);
		if (!loaded.ok) return { success: false, messages: adminMessages.notFound };
		const debt = loaded.debt;

		const permError = await this.requirePermission(actor, 'debts:manage', (debt.branchId as string) ?? null);
		if (permError) return permError;

		const scope = await PermissionChecker.getScope(actor.roleName, 'debts:manage');
		if (scope === 'own_branch' && debt.branchId !== actor.branchId) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		const payRes = await cbDebtPayments.document.query({
			statement: `SELECT RAW COUNT(*) FROM ${debtPaymentsKeyspace} WHERE debtId = $1`,
			args: [debtId],
			readonly: true
		});
		if (!payRes.ok) return { success: false, messages: adminMessages.queryFailed };
		const paymentCount = Number(payRes.data?.results?.[0] ?? 0);
		if (paymentCount > 0) {
			return { success: false, messages: adminMessages.hasPayments };
		}

		const delRes = await cbDebts.document.delete({ documentKey: debtId });
		if (!delRes.ok) return { success: false, messages: adminMessages.deleteFailed };

		void broadcastDbChange({ collection: 'debts', action: 'delete', by: actor.userId });
		return { success: true };
	}

	/** Load debt doc (không permission — dùng nội bộ sau khi đã check quyền). */
	private static async loadDebt(debtId: string): Promise<{ ok: false } | { ok: true; debt: any }> {
		const res = await cbDebts.document.get({ documentKey: debtId });
		if (!res.ok) return { ok: false };
		return { ok: true, debt: (res as any).data };
	}
}

// Danh sách giá trị hợp lệ export ra ngoài cho UI/probe tham chiếu nếu cần
export const DEBT_VALID_VALUES = {
	types: VALID_DEBT_TYPES,
	partyTypes: VALID_PARTY_TYPES,
	methods: VALID_METHODS,
	statuses: VALID_STATUSES
} as const;
