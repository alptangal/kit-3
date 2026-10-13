// src/routes/api/admin/purchase-orders/get/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SupplierService } from '$lib/server/db/suppliers';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ poId: string }>(event);
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

		if (!read.data.poId) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu poId',
						en: 'Missing poId'
					}
				},
				400
			);
		}

		const result = await SupplierService.getPurchaseOrder(actor, read.data.poId);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Lấy thông tin phiếu nhập hàng thành công', en: 'Purchase order fetched successfully' },
			data: result.po
		});
	} catch (e) {
		console.error('[POST /api/admin/purchase-orders/get]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
