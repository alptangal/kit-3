// src/routes/api/admin/suppliers/bulk-delete/+server.ts
// Xóa hàng loạt supplier (bulk action từ checkbox DataTable — 2026-10-21).
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
		const read = await readAdminRequest<{ ids?: string[] }>(event);
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

		const { ids } = read.data;
		if (!Array.isArray(ids) || ids.length === 0) {
			return respond(
				{
					ok: false,
					message: { vi: 'Thiếu danh sách mã NCC', en: 'Missing supplier ids' }
				},
				400
			);
		}

		const result = await SupplierService.bulkDeleteSuppliers(actor, ids);

		if (!result.success) {
			if (!result.messages) {
				return respond(
					{
						ok: false,
						message: { vi: 'Xóa thất bại', en: 'Delete failed' }
					},
					400
				);
			}
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Xóa NCC thành công', en: 'Suppliers deleted' },
			data: {
				deleted: result.deleted ?? [],
				failed: result.failed ?? []
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/suppliers/bulk-delete]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
