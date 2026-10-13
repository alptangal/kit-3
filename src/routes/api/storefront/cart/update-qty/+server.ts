// src/routes/api/storefront/cart/update-qty/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { CartService } from '$lib/server/db/cart';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ variantId?: string; quantity?: number }>(event);
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

		if (!read.data.variantId || typeof read.data.quantity !== 'number') {
			return respond(
				{ ok: false, message: { vi: 'Thiếu thông tin bắt buộc', en: 'Missing required fields' } },
				400
			);
		}

		const result = await CartService.updateItemQuantity(
			actor,
			actor.userId,
			read.data.variantId,
			read.data.quantity
		);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Cập nhật giỏ hàng thành công', en: 'Cart updated successfully' },
			data: { cart: result.cart }
		});
	} catch (e) {
		console.error('[POST /api/storefront/cart/update-qty]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
