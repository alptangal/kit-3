// src/routes/api/admin/brands/bulk/+server.ts
// Xóa hàng loạt thương hiệu (bulk action từ checkbox DataTable — Batch 54).
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext
} from '$lib/server/admin/api';
import { ProductAdminService } from '$lib/server/db/products';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	let secureResponder:
		| ((payload: Parameters<typeof respondEncrypted>[1], status?: number) => Promise<Response>)
		| undefined;
	try {
		const read = await readAdminRequest<{ ids?: string[] }>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);
		secureResponder = respond;

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
					message: { vi: 'Thiếu danh sách mã thương hiệu', en: 'Missing brand ids' }
				},
				400
			);
		}

		// Brands không có service bulk — allSettled từng deleteBrand, đếm success.
		const results = await Promise.allSettled(ids.map((id) => ProductAdminService.deleteBrand(actor, id)));
		const deleted = results.filter((r) => r.status === 'fulfilled' && r.value?.success === true).length;

		return respond({
			ok: true,
			message: {
				vi: `Đã xoá ${deleted}/${ids.length} thương hiệu`,
				en: `Deleted ${deleted}/${ids.length} brands`
			},
			data: {
				deleted,
				failed: ids.length - deleted
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/brands/bulk]', e);
		const fail = {
			ok: false,
			message: { vi: 'Xoá thương hiệu thất bại. Vui lòng thử lại.', en: 'Failed to delete brands. Please try again.' }
		};
		if (secureResponder) return secureResponder(fail, 500);
		return json({ ...fail }, { status: 500 });
	}
};
