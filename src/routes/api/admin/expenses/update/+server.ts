// src/routes/api/admin/expenses/update/+server.ts
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
			expenseId?: string;
			category?: string;
			amount?: number;
			spentAt?: string;
			description?: string | null;
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

		if (!read.data.expenseId) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu expenseId', en: 'expenseId is required' } },
				400
			);
		}

		const result = await ExpenseService.update(actor, read.data.expenseId, {
			category: read.data.category,
			amount: read.data.amount !== undefined ? Number(read.data.amount) : undefined,
			spentAt: read.data.spentAt,
			description: read.data.description,
			receiptImages: read.data.receiptImages
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Đã cập nhật chi phí', en: 'Expense updated' },
			data: { expense: result.expense }
		});
	} catch (e) {
		console.error('[POST /api/admin/expenses/update]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
