// src/routes/api/admin/stock-takes/start/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { StockTakeService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ stockTakeId: string }>(event);
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

		if (!read.data.stockTakeId) {
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

		const result = await StockTakeService.startStockTake(actor, read.data.stockTakeId);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Bắt đầu kiểm kê thành công', en: 'Stock take started successfully' },
			data: result.stockTake
		});
	} catch (e) {
		console.error('[POST /api/admin/stock-takes/start]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
