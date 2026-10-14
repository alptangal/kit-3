// src/routes/api/admin/purchases/get/+server.ts
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
		const read = await readAdminRequest<{ poId?: string; receive?: boolean; receivedItems?: Array<{ variantId: string; quantity: number; lotNumber?: string; manufacturedAt?: string | null; expiresAt?: string | null }> }>(event);
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

		if (!read.data?.poId) {
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

		// receive=true: nhận hàng qua PO (nút "Nhận hàng" trên PO status='ordered')
		if (read.data.receive) {
			const received = await SupplierService.receivePurchaseOrder(actor, read.data.poId, read.data.receivedItems);
			if (!received.success) {
				return respond({ ok: false, message: received.messages }, statusForServiceFailure(received.messages));
			}
			return respond({
				ok: true,
				message: { vi: 'Nhận hàng thành công', en: 'Purchase order received successfully' },
				data: { po: received.po }
			});
		}

		const result = await SupplierService.getPurchaseOrderWithImages(actor, read.data.poId);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Lấy phiếu nhập hàng thành công', en: 'Purchase order fetched successfully' },
			data: { po: result.po }
		});
	} catch (e) {
		console.error('[POST /api/admin/purchases/get]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
