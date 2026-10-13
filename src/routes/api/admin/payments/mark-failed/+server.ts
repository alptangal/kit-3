// src/routes/api/admin/payments/mark-failed/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { PaymentService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ paymentId: string; reason: string }>(event);
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

		if (!read.data.paymentId) {
			return respond({ ok: false, message: { vi: 'Thiếu ID thanh toán', en: 'Missing payment ID' } }, 400);
		}

		const result = await PaymentService.markFailed(actor, read.data.paymentId, read.data.reason ?? '');

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: {
				vi: 'Đã đánh dấu thanh toán thất bại',
				en: 'Payment marked as failed'
			},
			data: { payment: result.data }
		});
	} catch (e) {
		console.error('[POST /api/admin/payments/mark-failed]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
