// src/routes/api/admin/orders/update-status/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { OrderService } from '$lib/server/db/orders';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			orderId: string;
			status: string;
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

		if (!read.data.orderId || !read.data.status) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu orderId hoặc status',
						en: 'Missing orderId or status'
					}
				},
				400
			);
		}

		const result = await OrderService.updateOrderStatus(actor, read.data.orderId, read.data.status as any);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Cập nhật trạng thái đơn hàng thành công', en: 'Order status updated successfully' },
			data: result.order
		});
	} catch (e) {
		console.error('[POST /api/admin/orders/update-status]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
