// src/routes/api/admin/orders/create/+server.ts
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
			orderCode: string;
			customerId?: string;
			branchId: string;
			items: Array<{
				variantId: string;
				lotId?: string;
				quantity: number;
				price: number;
			}>;
			totalAmount: number;
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

		if (!read.data.orderCode || !read.data.branchId || !read.data.items || read.data.items.length === 0) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu thông tin bắt buộc',
						en: 'Missing required fields'
					}
				},
				400
			);
		}

		const result = await OrderService.createOrder(actor, {
			orderCode: read.data.orderCode,
			customerId: read.data.customerId,
			branchId: read.data.branchId,
			items: read.data.items,
			totalAmount: read.data.totalAmount
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Tạo đơn hàng thành công', en: 'Order created successfully' },
			data: result.order
		});
	} catch (e) {
		console.error('[POST /api/admin/orders/create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
