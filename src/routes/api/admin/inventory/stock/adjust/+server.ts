// src/routes/api/admin/inventory/stock/adjust/+server.ts
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
			change: number;
			referenceType?: string;
			referenceId?: string;
			note?: string;
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

		if (!read.data.variantId || !read.data.branchId || read.data.change === undefined) {
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

		const result = await InventoryService.adjustStock(
			actor,
			read.data.variantId,
			read.data.branchId,
			read.data.change,
			read.data.referenceType,
			read.data.referenceId,
			actor.userId,
			read.data.note
		);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Cập nhật tồn kho thành công', en: 'Inventory updated successfully' },
			data: result.updatedStock
		});
	} catch (e) {
		console.error('[POST /api/admin/inventory/stock/adjust]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
