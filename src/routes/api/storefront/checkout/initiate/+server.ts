// src/routes/api/storefront/checkout/initiate/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { CheckoutService, type ShippingAddress } from '$lib/server/db/checkout';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			cartId?: string;
			shippingAddress?: ShippingAddress;
			paymentMethod?: string;
			notes?: string;
		}>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		if (!read.data.cartId || !read.data.shippingAddress || !read.data.paymentMethod) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu thông tin bắt buộc', en: 'Missing required fields' } },
				400
			);
		}

		const result = await CheckoutService.initiateCheckout(
			actor,
			actor.userId,
			read.data.cartId,
			read.data.shippingAddress,
			read.data.paymentMethod,
			{ notes: read.data.notes }
		);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Đặt hàng thành công', en: 'Order placed successfully' },
			data: { checkout: result.checkout, orderId: result.orderId, orderCode: result.orderCode }
		});
	} catch (e) {
		console.error('[POST /api/storefront/checkout/initiate]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
