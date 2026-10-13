// src/routes/api/admin/fulfillment/awaiting-pickup/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { FulfillmentService } from '$lib/server/db';
import { broadcastDbChange } from '$lib/server/db-broadcast';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ orderId: string }>(event);
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
			return respond({ ok: false, message: { vi: 'Thiếu ID đơn hàng', en: 'Missing order ID' } }, 400);
		}

		const result = await FulfillmentService.markAwaitingPickup(actor, read.data.orderId);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		void broadcastDbChange({ collection: 'orders', action: 'set-status', by: actor.userId });

		return respond({
			ok: true,
			message: {
				vi: 'Đã chuyển đơn sang chờ khách nhận tại cửa hàng',
				en: 'Order marked as awaiting pickup'
			},
			data: { order: result.data }
		});
	} catch (e) {
		console.error('[POST /api/admin/fulfillment/awaiting-pickup]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
