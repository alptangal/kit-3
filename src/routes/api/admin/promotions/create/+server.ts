// src/routes/api/admin/promotions/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { PricingService } from '$lib/server/db';
import type { PromotionType } from '$lib/server/db/pricing';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			code: string;
			name: string;
			type: PromotionType;
			value: number;
			minOrderValue?: number;
			maxDiscountAmount?: number;
			usageLimit?: number;
			startAt: string;
			endAt: string;
			status: string;
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
			!read.data.code ||
			!read.data.name ||
			!read.data.type ||
			typeof read.data.value !== 'number' ||
			!read.data.startAt ||
			!read.data.endAt
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

		const result = await PricingService.createPromotion(actor, {
			code: read.data.code,
			name: read.data.name,
			type: read.data.type,
			value: read.data.value,
			minOrderValue: read.data.minOrderValue,
			maxDiscountAmount: read.data.maxDiscountAmount,
			usageLimit: read.data.usageLimit,
			startAt: read.data.startAt,
			endAt: read.data.endAt,
			status: read.data.status
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Tạo khuyến mãi thành công', en: 'Promotion created successfully' },
			data: result.promotion
		});
	} catch (e) {
		console.error('[POST /api/admin/promotions/create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
