// src/routes/api/admin/variants/latest-prices/+server.ts
// POST { variantId, branchId? } → giá bán + giá nhập gần nhất từ price_history (P2 gợi ý giá).

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { AnalyticsService } from '$lib/server/db/analytics';

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

		if (!read.data?.variantId) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu variantId', en: 'Missing variantId' } },
				400
			);
		}

		const result = await AnalyticsService.latestPrices(actor, {
			variantId: read.data.variantId,
			branchId: read.data.branchId
		});

		if (!result.success) {
			const messages = result.messages ?? { vi: 'Lỗi truy vấn', en: 'Query failed' };
			return respond({ ok: false, message: messages }, statusForServiceFailure(messages));
		}

		return respond({ ok: true, data: result });
	} catch (e) {
		console.error('[POST /api/admin/variants/latest-prices]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
