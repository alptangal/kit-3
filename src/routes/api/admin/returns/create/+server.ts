// src/routes/api/admin/returns/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { ReturnService } from '$lib/server/db/returns';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			orderId: string;
			returnBranchId?: string;
			items: Array<{ variantId: string; quantity: number; reason?: string; lotId?: string }>;
			refundNote?: string;
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

		if (!read.data.orderId) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu mã đơn hàng', en: 'Missing order id' } },
				400
			);
		}

		const result = await ReturnService.create(actor, {
			orderId: read.data.orderId,
			returnBranchId: read.data.returnBranchId,
			items: read.data.items ?? [],
			refundNote: read.data.refundNote
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Tạo phiếu đổi trả thành công', en: 'Return created successfully' },
			data: { ret: result.ret }
		});
	} catch (e) {
		console.error('[POST /api/admin/returns/create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
