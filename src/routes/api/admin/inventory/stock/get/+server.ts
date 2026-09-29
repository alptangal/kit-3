// src/routes/api/admin/inventory/stock/get/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { InventoryService } from '$lib/server/db/inventory';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			variantId: string;
			branchId: string;
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

		if (!read.data.variantId || !read.data.branchId) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu variantId hoặc branchId',
						en: 'Missing variantId or branchId'
					}
				},
				400
			);
		}

		const result = await InventoryService.getStock(actor, read.data.variantId, read.data.branchId);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Lấy thông tin tồn kho thành công', en: 'Inventory fetched successfully' },
			data: result.stock
		});
	} catch (e) {
		console.error('[POST /api/admin/inventory/stock/get]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
