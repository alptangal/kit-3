// src/routes/api/admin/stock-takes/items/add/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { StockTakeService } from '$lib/server/db';
import type { StockTakeItem } from '$lib/server/db/stock-takes';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			stockTakeId: string;
			item: StockTakeItem;
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

		if (
			!read.data.stockTakeId ||
			!read.data.item ||
			!read.data.item.variantId ||
			typeof read.data.item.systemQuantity !== 'number' ||
			typeof read.data.item.countedQuantity !== 'number'
		) {
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

		const result = await StockTakeService.addStockTakeItem(actor, read.data.stockTakeId, read.data.item);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Thêm dòng kiểm kê thành công', en: 'Stock take item added successfully' }
		});
	} catch (e) {
		console.error('[POST /api/admin/stock-takes/items/add]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
