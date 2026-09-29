// src/routes/api/admin/purchase-orders/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SupplierService } from '$lib/server/db/suppliers';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			poCode: string;
			supplierId: string;
			branchId: string;
			items: Array<{
				variantId: string;
				quantity: number;
				unitCost: number;
				lotNumber?: string;
				expiresAt?: string;
			}>;
			totalCost: number;
			expectedAt: string;
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

		if (!read.data.poCode || !read.data.supplierId || !read.data.branchId || !read.data.items || read.data.items.length === 0) {
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

		const result = await SupplierService.createPurchaseOrder(actor, {
			poCode: read.data.poCode,
			supplierId: read.data.supplierId,
			branchId: read.data.branchId,
			items: read.data.items,
			totalCost: read.data.totalCost,
			expectedAt: read.data.expectedAt
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Tạo phiếu nhập hàng thành công', en: 'Purchase order created successfully' },
			data: result.po
		});
	} catch (e) {
		console.error('[POST /api/admin/purchase-orders/create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
