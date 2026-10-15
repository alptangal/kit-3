// src/routes/api/admin/debts/record-payment/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { DebtService } from '$lib/server/db/debts';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			id: string;
			amount: number;
			method: string;
			paidAt?: string | null;
			notes?: string | null;
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

		if (!read.data.id || !read.data.amount || !read.data.method) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu thông tin thanh toán (ID/số tiền/phương thức)',
						en: 'Missing payment info (id/amount/method)'
					}
				},
				400
			);
		}

		const result = await DebtService.recordPayment(actor, read.data.id, {
			amount: Number(read.data.amount),
			method: read.data.method,
			paidAt: read.data.paidAt ?? null,
			notes: read.data.notes ?? null
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Ghi nhận thanh toán thành công', en: 'Payment recorded successfully' },
			data: {
				debt: result.debt,
				payment: result.payment
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/debts/record-payment]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
