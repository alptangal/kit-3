// src/routes/api/admin/analytics/query/+server.ts
// POST { type: 'cost-trend' | 'supplier-comparison' | 'purchase-volume' | 'stock-trend' | 'price-trend' | 'supplier-summary' | 'product-summary' | 'variant-summary' | 'brand-summary' | 'category-summary', ...params }
// 1 route duy nhất cho toàn bộ thống kê — switch theo type gọi AnalyticsService.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { AnalyticsService } from '$lib/server/db/analytics';

const VALID_TYPES = ['cost-trend', 'supplier-comparison', 'purchase-volume', 'stock-trend', 'price-trend', 'supplier-summary', 'product-summary', 'variant-summary', 'brand-summary', 'category-summary'] as const;
type AnalyticsType = (typeof VALID_TYPES)[number];

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			type: string;
			variantId?: string;
			branchId?: string;
			supplierId?: string;
			productId?: string;
			brandId?: string;
			categoryId?: string;
			from?: string;
			to?: string;
			groupBy?: string;
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

		const { type, ...params } = read.data;
		if (!VALID_TYPES.includes(type as AnalyticsType)) {
			return respond({
				ok: false,
				message: {
					vi: `Loại thống kê không hợp lệ — hợp lệ: ${VALID_TYPES.join(', ')}`,
					en: `Invalid analytics type — valid: ${VALID_TYPES.join(', ')}`
				}
			});
		}

		let result: Awaited<ReturnType<typeof AnalyticsService.costTrend>> | Awaited<
			ReturnType<typeof AnalyticsService.supplierPriceComparison>
		> | Awaited<ReturnType<typeof AnalyticsService.purchaseVolumeTrend>> | Awaited<
			ReturnType<typeof AnalyticsService.stockTrend>
		> | Awaited<ReturnType<typeof AnalyticsService.priceTrend>> | Awaited<
			ReturnType<typeof AnalyticsService.supplierSummary>
		> | Awaited<
			ReturnType<typeof AnalyticsService.productSummary>
		> | Awaited<
			ReturnType<typeof AnalyticsService.variantSummary>
		> | Awaited<
			ReturnType<typeof AnalyticsService.brandSummary>
		> | Awaited<
			ReturnType<typeof AnalyticsService.categorySummary>
		>;

		switch (type as AnalyticsType) {
			case 'cost-trend':
				result = await AnalyticsService.costTrend(actor, params);
				break;
			case 'supplier-comparison':
				result = await AnalyticsService.supplierPriceComparison(actor, { variantId: params.variantId ?? '' });
				break;
			case 'purchase-volume':
				result = await AnalyticsService.purchaseVolumeTrend(actor, params);
				break;
			case 'stock-trend':
				result = await AnalyticsService.stockTrend(actor, params);
				break;
			case 'price-trend':
				result = await AnalyticsService.priceTrend(actor, params);
				break;
			case 'supplier-summary':
				result = await AnalyticsService.supplierSummary(actor, {
					supplierId: params.supplierId ?? '',
					from: params.from,
					to: params.to
				});
				break;
			case 'product-summary':
				result = await AnalyticsService.productSummary(actor, {
					productId: params.productId ?? '',
					from: params.from,
					to: params.to
				});
				break;
			case 'variant-summary':
				result = await AnalyticsService.variantSummary(actor, {
					variantId: params.variantId ?? '',
					from: params.from,
					to: params.to
				});
				break;
			case 'brand-summary':
				result = await AnalyticsService.brandSummary(actor, {
					brandId: params.brandId ?? '',
					from: params.from,
					to: params.to
				});
				break;
			case 'category-summary':
				result = await AnalyticsService.categorySummary(actor, {
					categoryId: params.categoryId ?? '',
					from: params.from,
					to: params.to
				});
				break;
			default:
				return respond({ ok: false, message: { vi: 'Loại thống kê không hợp lệ', en: 'Invalid analytics type' } });
		}

		if (!result.success) {
			return respond(
				{ ok: false, message: result.messages ?? { vi: 'Lỗi truy vấn', en: 'Query failed' } },
				statusForServiceFailure(result.messages as never)
			);
		}

		return respond({ ok: true, data: result });
	} catch (e) {
		console.error('[POST /api/admin/analytics/query]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
