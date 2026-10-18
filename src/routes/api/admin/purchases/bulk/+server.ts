// src/routes/api/admin/purchases/bulk/+server.ts
// C9: Xóa / cập nhật trạng thái hàng loạt purchase orders.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SupplierService } from '$lib/server/db/suppliers';

const VALID_ACTIONS = ['delete', 'status'] as const;

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			ids?: string[];
			action?: string;
			status?: string;
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

		const { ids, action, status } = read.data;
		if (!Array.isArray(ids) || ids.length === 0) {
			return respond(
				{
					ok: false,
					message: { vi: 'Thiếu danh sách mã phiếu', en: 'Missing purchase order ids' }
				},
				400
			);
		}
		if (!action || !VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
			return respond(
				{
					ok: false,
					message: { vi: 'Hành động không hợp lệ', en: 'Invalid action' }
				},
				400
			);
		}

		const result = await SupplierService.bulkPurchaseOrders(actor, {
			ids,
			action: action as 'delete' | 'status',
			status
		});

		if (!result.success) {
			if (!result.messages) {
				return respond(
					{
						ok: false,
						message: { vi: 'Thao tác thất bại', en: 'Action failed' }
					},
					400
				);
			}
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Thao tác hàng loạt thành công', en: 'Bulk action completed' },
			data: {
				deleted: result.deleted ?? [],
				updated: result.updated ?? [],
				failed: result.failed ?? []
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/purchases/bulk]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
