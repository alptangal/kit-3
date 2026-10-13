// src/routes/api/storefront/products/list/+server.ts
// Public products list cho storefront — chỉ trả product active + variant active,
// KHÔNG lộ cost fields (costPrice/createdBy). Vẫn qua readAdminRequest (RSA
// contract đồng bộ toàn bộ API) + rate limit; KHÔNG yêu cầu đăng nhập.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted } from '$lib/server/admin/api';
import { ProductAdminService } from '$lib/server/db/products';

export const POST: RequestHandler = async (event) => {
	try {
		const read = await readAdminRequest<{
			page?: number;
			pageSize?: number;
			search?: string;
			categoryId?: string;
			brandId?: string;
		}>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const result = await ProductAdminService.listStorefront({
			page: read.data.page,
			pageSize: read.data.pageSize,
			search: read.data.search,
			categoryId: read.data.categoryId,
			brandId: read.data.brandId
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, 400);
		}

		return respond({
			ok: true,
			message: { vi: 'Lấy danh sách sản phẩm thành công', en: 'Product list fetched successfully' },
			data: {
				products: result.products,
				total: result.total,
				page: result.page,
				pageSize: result.pageSize
			}
		});
	} catch (e) {
		console.error('[POST /api/storefront/products/list]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
