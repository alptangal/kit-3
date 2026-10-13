// src/routes/api/storefront/cart/get/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { CartService } from '$lib/server/db/cart';

// Storefront cart: user thường truy cập cart của CHÍNH MÌNH — userId lấy từ
// actor (không tin client truyền userId). branchId lấy từ actor nếu có.
export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ branchId?: string }>(event);
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

		const result = await CartService.getOrCreateCart(actor, actor.userId, read.data.branchId ?? actor.branchId ?? null);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Lấy giỏ hàng thành công', en: 'Cart fetched successfully' },
			data: { cart: result.cart }
		});
	} catch (e) {
		console.error('[POST /api/storefront/cart/get]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
