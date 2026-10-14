// src/routes/api/admin/expenses/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { ExpenseService } from '$lib/server/db/expenses';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			branchId?: string;
			category?: string;
			amount?: number;
			spentAt?: string;
			description?: string;
			receiptImages?: string[];
		}>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Phiên đăng nhập đã hết hạn',
						en: 'Session expired'
					}
				},
				401
			);
		}

		if (!read.data.branchId || !read.data.category || read.data.amount === undefined || !read.data.spentAt) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu thông tin bắt buộc (chi nhánh, danh mục, số tiền, ngày chi)',
						en: 'Missing required fields (branch, category, amount, spent date)'
					}
				},
				400
			);
		}

		const result = await ExpenseService.create(actor, {
			branchId: read.data.branchId,
			category: read.data.category,
			amount: Number(read.data.amount),
			spentAt: read.data.spentAt,
			description: read.data.description,
			receiptImages: read.data.receiptImages
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Đã tạo bản ghi chi phí', en: 'Expense record created' },
			data: { expense: result.expense }
		});
	} catch (e) {
		console.error('[POST /api/admin/expenses/create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
