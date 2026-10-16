// src/routes/api/admin/purchases/return/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SupplierService } from '$lib/server/db/suppliers';

interface ReturnItemInput {
	variantId: string;
	quantity: number;
	unitCost?: number;
	lotId?: string;
	serials?: string[];
}

interface PurchaseReturnInput {
	supplierId: string;
	branchId: string;
	items: ReturnItemInput[];
	reason?: string;
}

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<PurchaseReturnInput>(event);
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

		const input = read.data;
		if (
			!input ||
			!input.supplierId ||
			!input.branchId ||
			!Array.isArray(input.items) ||
			input.items.length === 0
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

		const result = await SupplierService.createPurchaseReturn(actor, input);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		const failedLines = result.results.filter((r) => !r.ok);
		return respond({
			ok: true,
			message: {
				vi: failedLines.length
					? `Trả hàng thành công một phần (${failedLines.length} dòng thiếu tồn kho)`
					: 'Trả hàng NCC thành công',
				en: failedLines.length
					? `Partially returned (${failedLines.length} line(s) lacked stock)`
					: 'Purchase return created successfully'
			},
			data: {
				returnId: result.returnId,
				returnCode: result.returnCode,
				results: result.results
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/purchases/return]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
