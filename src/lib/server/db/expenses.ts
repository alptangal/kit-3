// $lib/server/db/expenses.ts
// Chi phí vận hành (operating expenses) — CRUD + thống kê theo kỳ.

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import type { ActorContext } from './suppliers';

const cbExpenses = cbData('operating_expenses');
const expensesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`operating_expenses\``;

const expenseMessages = {
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	} as TranslateContent,
	notFound: { vi: 'Không tìm thấy bản ghi chi phí', en: 'Expense record not found' } as TranslateContent,
	queryFailed: { vi: 'Truy vấn chi phí thất bại', en: 'Failed to query expenses' } as TranslateContent,
	createFailed: { vi: 'Tạo bản ghi chi phí thất bại', en: 'Failed to create expense record' } as TranslateContent,
	updateFailed: { vi: 'Cập nhật chi phí thất bại', en: 'Failed to update expense record' } as TranslateContent,
	deleteFailed: { vi: 'Xóa chi phí thất bại', en: 'Failed to delete expense record' } as TranslateContent,
	invalidCategory: {
		vi: 'Danh mục chi phí không hợp lệ',
		en: 'Invalid expense category'
	} as TranslateContent,
	invalidAmount: { vi: 'Số tiền không hợp lệ', en: 'Invalid amount' } as TranslateContent,
	invalidDate: { vi: 'Ngày chi không hợp lệ', en: 'Invalid spent date' } as TranslateContent,
	invalidBranch: { vi: 'Chi nhánh là bắt buộc', en: 'Branch is required' } as TranslateContent,
	invalidImages: {
		vi: 'Ảnh hóa đơn không hợp lệ (tối đa 3 ảnh)',
		en: 'Invalid receipt images (max 3)'
	} as TranslateContent
} as const;

const EXPENSE_SAFE_FIELDS = [
	'branchId',
	'category',
	'amount',
	'spentAt',
	'description',
	'receiptImages',
	'createdBy',
	'createdAt',
	'updatedAt'
] as const;

export const EXPENSE_CATEGORIES = ['rent', 'salary', 'utility', 'marketing', 'logistics', 'other'] as const;
type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const MAX_RECEIPT_IMAGES = 3;

function sanitizeExpenseForAdmin(doc: Record<string, unknown> & { _id?: string }) {
	const safe: Record<string, unknown> = { _id: doc._id };
	for (const field of EXPENSE_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	return safe;
}

function isValidBase64Image(value: unknown): boolean {
	return typeof value === 'string' && value.startsWith('data:image/');
}

export class ExpenseService {
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
		if (!allowed) return { success: false, messages: expenseMessages.permissionDenied };
		return null;
	}

	/** Liệt kê chi phí — filter branch/category/khoảng spentAt + paginate + thống kê. */
	static async list(
		actor: ActorContext,
		options: {
			branchId?: string;
			category?: string;
			from?: string;
			to?: string;
			page?: number;
			pageSize?: number;
		} = {}
	): Promise<
		| { success: false; messages: TranslateContent }
		| {
				success: true;
				items: Record<string, unknown>[];
				total: number;
				page: number;
				pageSize: number;
				totalAmount: number;
				categoryBreakdown: { category: string; total: number }[];
		  }
	> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'expenses:read');
		if (!scope) return { success: false, messages: expenseMessages.permissionDenied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		// Điều kiện thống kê (toàn kỳ, không phân trang) — scope own_branch ép theo actor
		const statConditions: string[] = [];
		const statArgs: (string | number)[] = [];
		if (scope === 'own_branch') {
			if (!actor.branchId) return { success: false, messages: expenseMessages.permissionDenied };
			statConditions.push('branchId = $' + (statArgs.length + 1));
			statArgs.push(actor.branchId);
		}
		if (options.branchId) {
			statConditions.push('branchId = $' + (statArgs.length + 1));
			statArgs.push(options.branchId);
		}
		if (options.category) {
			statConditions.push('category = $' + (statArgs.length + 1));
			statArgs.push(options.category);
		}
		if (options.from) {
			statConditions.push('spentAt >= $' + (statArgs.length + 1));
			statArgs.push(options.from);
		}
		if (options.to) {
			statConditions.push('spentAt <= $' + (statArgs.length + 1));
			statArgs.push(options.to);
		}
		const statWhere = statConditions.length ? `WHERE ${statConditions.join(' AND ')}` : '';
		const statStatement = `SELECT category, SUM(amount) AS total FROM ${expensesKeyspace} ${statWhere} GROUP BY category ORDER BY total DESC`;
		const totalStatement = `SELECT RAW SUM(amount) FROM ${expensesKeyspace} ${statWhere}`;

		// Điều kiện danh sách (giống thống kê + phân trang)
		const conditions = [...statConditions];
		const args = [...statArgs];
		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = 'META().id AS _id, ' + EXPENSE_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');
		const listStatement = `SELECT ${selectClause} FROM ${expensesKeyspace} ${whereClause} ORDER BY spentAt DESC LIMIT ${pageSize} OFFSET ${offset}`;
		const countStatement = `SELECT RAW COUNT(*) FROM ${expensesKeyspace} ${whereClause}`;

		try {
			const [countRes, dataRes, totalRes, breakdownRes] = await Promise.all([
				cbExpenses.document.query({ statement: countStatement, args, readonly: true }),
				cbExpenses.document.query({ statement: listStatement, args, readonly: true }),
				cbExpenses.document.query({ statement: totalStatement, args: statArgs, readonly: true }),
				cbExpenses.document.query({ statement: statStatement, args: statArgs, readonly: true })
			]);

			if (!countRes.ok || !dataRes.ok || !totalRes.ok || !breakdownRes.ok) {
				return { success: false, messages: expenseMessages.queryFailed };
			}

			const total = Number(countRes.data?.results?.[0] ?? 0);
			const items = (dataRes.data?.results ?? []).map((doc: Record<string, unknown>) =>
				sanitizeExpenseForAdmin(doc as Record<string, unknown> & { _id?: string })
			);
			const totalAmount = Number(totalRes.data?.results?.[0] ?? 0) || 0;
			const categoryBreakdown = (breakdownRes.data?.results ?? []).map(
				(row: { category?: string; total?: number }) => ({
					category: String(row.category ?? 'other'),
					total: Number(row.total ?? 0)
				})
			);

			return { success: true, items, total, page, pageSize, totalAmount, categoryBreakdown };
		} catch {
			return { success: false, messages: expenseMessages.queryFailed };
		}
	}

	/** Lấy 1 bản ghi chi phí. */
	static async get(
		actor: ActorContext,
		expenseId: string
	): Promise<
		{ success: false; messages: TranslateContent } | { success: true; expense: Record<string, unknown> }
	> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'expenses:read');
		if (!scope) return { success: false, messages: expenseMessages.permissionDenied };

		const res = await cbExpenses.document.get({ documentKey: expenseId });
		if (!res.ok) return { success: false, messages: expenseMessages.notFound };

		const expense = (res as { data?: Record<string, unknown> }).data ?? {};
		if (scope === 'own_branch' && actor.branchId && expense.branchId !== actor.branchId) {
			return { success: false, messages: expenseMessages.permissionDenied };
		}
		return { success: true, expense: sanitizeExpenseForAdmin({ ...expense, _id: expenseId }) };
	}

	/** Tạo bản ghi chi phí. */
	static async create(
		actor: ActorContext,
		data: {
			branchId: string;
			category: string;
			amount: number;
			spentAt: string;
			description?: string;
			receiptImages?: string[];
		}
	): Promise<
		{ success: false; messages: TranslateContent } | { success: true; expense: Record<string, unknown> }
	> {
		if (!EXPENSE_CATEGORIES.includes(data.category as ExpenseCategory)) {
			return { success: false, messages: expenseMessages.invalidCategory };
		}
		if (!Number.isFinite(data.amount) || data.amount < 0) {
			return { success: false, messages: expenseMessages.invalidAmount };
		}
		if (!data.spentAt || Number.isNaN(Date.parse(data.spentAt))) {
			return { success: false, messages: expenseMessages.invalidDate };
		}
		if (!data.branchId) return { success: false, messages: expenseMessages.invalidBranch };
		if (data.receiptImages && data.receiptImages.length > MAX_RECEIPT_IMAGES) {
			return { success: false, messages: expenseMessages.invalidImages };
		}
		if (data.receiptImages?.some((img) => !isValidBase64Image(img))) {
			return { success: false, messages: expenseMessages.invalidImages };
		}

		const permError = await this.requirePermission(actor, 'expenses:manage', data.branchId);
		if (permError) return permError;

		const expenseId = `expense_${Date.now()}_${Math.random().toString(36).substring(7)}`;
		const now = new Date().toISOString();

		const expense = {
			branchId: data.branchId,
			category: data.category,
			amount: data.amount,
			spentAt: data.spentAt,
			description: data.description ?? null,
			receiptImages: data.receiptImages ?? [],
			createdBy: actor.userId,
			createdAt: now,
			updatedAt: now
		};

		const createRes = await cbExpenses.document.create({ documentKey: expenseId, content: expense });
		if (!createRes.ok) return { success: false, messages: expenseMessages.createFailed };

		return { success: true, expense: sanitizeExpenseForAdmin({ ...expense, _id: expenseId }) };
	}

	/** Cập nhật bản ghi chi phí. */
	static async update(
		actor: ActorContext,
		expenseId: string,
		data: {
			category?: string;
			amount?: number;
			spentAt?: string;
			description?: string | null;
			receiptImages?: string[];
		}
	): Promise<
		{ success: false; messages: TranslateContent } | { success: true; expense: Record<string, unknown> }
	> {
		if (data.category !== undefined && !EXPENSE_CATEGORIES.includes(data.category as ExpenseCategory)) {
			return { success: false, messages: expenseMessages.invalidCategory };
		}
		if (data.amount !== undefined && (!Number.isFinite(data.amount) || data.amount < 0)) {
			return { success: false, messages: expenseMessages.invalidAmount };
		}
		if (data.spentAt !== undefined && (!data.spentAt || Number.isNaN(Date.parse(data.spentAt)))) {
			return { success: false, messages: expenseMessages.invalidDate };
		}
		if (data.receiptImages && data.receiptImages.length > MAX_RECEIPT_IMAGES) {
			return { success: false, messages: expenseMessages.invalidImages };
		}
		if (data.receiptImages?.some((img) => !isValidBase64Image(img))) {
			return { success: false, messages: expenseMessages.invalidImages };
		}

		const getRes = await cbExpenses.document.get({ documentKey: expenseId });
		if (!getRes.ok) return { success: false, messages: expenseMessages.notFound };

		const existing = (getRes as { data?: Record<string, unknown> }).data ?? {};
		const permError = await this.requirePermission(actor, 'expenses:manage', existing.branchId as string);
		if (permError) return permError;

		const now = new Date().toISOString();
		const updated: Record<string, unknown> = {
			...existing,
			category: data.category ?? existing.category,
			amount: data.amount ?? existing.amount,
			spentAt: data.spentAt ?? existing.spentAt,
			description: data.description !== undefined ? data.description : existing.description,
			receiptImages: data.receiptImages ?? existing.receiptImages,
			updatedAt: now
		};

		const updateRes = await cbExpenses.document.update({ documentKey: expenseId, content: updated });
		if (!updateRes.ok) return { success: false, messages: expenseMessages.updateFailed };

		return { success: true, expense: sanitizeExpenseForAdmin({ ...updated, _id: expenseId }) };
	}

	/** Xóa bản ghi chi phí. */
	static async delete(
		actor: ActorContext,
		expenseId: string
	): Promise<{ success: false; messages: TranslateContent } | { success: true }> {
		const getRes = await cbExpenses.document.get({ documentKey: expenseId });
		if (!getRes.ok) return { success: false, messages: expenseMessages.notFound };

		const existing = (getRes as { data?: Record<string, unknown> }).data ?? {};
		const permError = await this.requirePermission(actor, 'expenses:manage', existing.branchId as string);
		if (permError) return permError;

		const deleteRes = await cbExpenses.document.delete({ documentKey: expenseId });
		if (!deleteRes.ok) return { success: false, messages: expenseMessages.deleteFailed };
		return { success: true };
	}
}
