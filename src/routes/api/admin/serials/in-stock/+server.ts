// src/routes/api/admin/serials/in-stock/+server.ts
// Serial in_stock của 1 variant tại 1 branch — phục vụ POS picker (bán hàng trackSerial).
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SerialService } from '$lib/server/db/serials';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;
	try {
		const read = await readAdminRequest<{ variantId?: string; branchId?: string }>(event);
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

		const variantId = (read.data.variantId ?? '').trim();
		const branchId = (read.data.branchId ?? '').trim() || actor.branchId || '';
		if (!variantId || !branchId) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu variantId hoặc branchId', en: 'Missing variantId or branchId' } },
				400
			);
		}

		const result = await SerialService.listInStockForVariant(actor, variantId, branchId);
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}
		return respond({
			ok: true,
			message: { vi: 'Tải serial tồn kho thành công', en: 'In-stock serials loaded' },
			data: { items: result.items }
		});
	} catch (e) {
		console.error('[POST /api/admin/serials/in-stock]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
