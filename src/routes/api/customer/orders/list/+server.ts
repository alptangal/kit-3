// src/routes/api/customer/orders/list/+server.ts
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
			page?: number;
			pageSize?: number;
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

		// Customer can only view their own orders
		const result = await OrderService.getCustomerOrders(actor, actor.userId, {
			page: read.data.page,
			pageSize: read.data.pageSize
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Lấy danh sách đơn hàng thành công', en: 'Order list fetched successfully' },
			data: {
				items: result.items,
				total: result.total,
				page: result.page,
				pageSize: result.pageSize
			}
		});
	} catch (e) {
		console.error('[POST /api/customer/orders/list]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
