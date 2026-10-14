// src/routes/api/admin/variants/update/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { broadcastDbChange } from '$lib/server/db-broadcast';
import { ProductAdminService } from '$lib/server/db/products';
import { AnalyticsService } from '$lib/server/db/analytics';
import { cbData } from '$modules/couchbase/clients';

const cbVariantsForHistory = cbData('product_variants');

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			documentKey: string;
			sku?: string;
			barcode?: string | null;
			attributes?: Record<string, string>;
			displayName?: string;
			price?: number;
			costPrice?: number | null;
			weight?: number | null;
			trackLot?: boolean;
			trackExpiry?: boolean;
			lowStockThreshold?: number | null;
			imageUrl?: string | null;
			status?: string;
		}>(event);
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

		const { documentKey, ...data } = read.data;

		// Đọc giá hiện tại TRƯỚC khi update để ghi price_history nếu giá đổi
		const oldRes = await cbVariantsForHistory.document.get({ documentKey });
		const oldVariant = oldRes.ok
			? (oldRes.data as { price?: number; costPrice?: number; branchId?: string } | undefined)
			: undefined;

		const result = await ProductAdminService.updateVariant(actor, documentKey, data);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		// Ghi lịch sử biến động giá (bỏ qua lỗi — không chặn update)
		if (oldVariant) {
			const entries: Parameters<typeof AnalyticsService.recordPriceHistory>[1] = [];
			if (typeof data.price === 'number' && data.price !== oldVariant.price) {
				entries.push({
					entity: 'variant_price',
					variantId: documentKey,
					branchId: oldVariant.branchId,
					oldPrice: typeof oldVariant.price === 'number' ? oldVariant.price : 0,
					newPrice: data.price,
					source: 'manual'
				});
			}
			if (data.costPrice !== undefined && data.costPrice !== null && data.costPrice !== oldVariant.costPrice) {
				entries.push({
					entity: 'variant_cost',
					variantId: documentKey,
					branchId: oldVariant.branchId,
					oldPrice: typeof oldVariant.costPrice === 'number' ? oldVariant.costPrice : 0,
					newPrice: data.costPrice,
					source: 'manual'
				});
			}
			if (entries.length > 0) {
				void AnalyticsService.recordPriceHistory(actor, entries).catch((e) =>
					console.error('[variants/update] recordPriceHistory failed:', e)
				);
			}
		}

		void broadcastDbChange({ collection: 'variants', action: 'update', by: actor?.userId });

		return respond({ ok: true, message: result.messages });
	} catch (e) {
		console.error('[POST /api/admin/variants/update]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};