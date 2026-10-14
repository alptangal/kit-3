// src/routes/api/admin/expiry/create-promotion/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { ExpiryService } from '$lib/server/db/expiry';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			lotIds?: string[];
			discountPercent?: number;
			days?: number;
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

		if (!Array.isArray(read.data?.lotIds) || read.data.lotIds.length === 0) {
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

		const result = await ExpiryService.createClearancePromotion(actor, {
			lotIds: read.data.lotIds,
			discountPercent: Number(read.data.discountPercent),
			days: read.data.days
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Tạo khuyến mãi xả hàng thành công', en: 'Clearance promotion created successfully' },
			data: { promotion: result.promotion }
		});
	} catch (e) {
		console.error('[POST /api/admin/expiry/create-promotion]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
