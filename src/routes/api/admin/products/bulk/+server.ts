// src/routes/api/admin/products/bulk/+server.ts
// B54: xoá hàng loạt sản phẩm (bulk action từ checkbox DataTable — pattern
// suppliers bulk-delete; từng id đi qua ProductAdminService.delete → allSettled).
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
					message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' }
				},
				401
			);
		}

		const { ids } = read.data;
		if (!Array.isArray(ids) || ids.length === 0) {
			return respond(
				{
					ok: false,
					message: { vi: 'Thiếu danh sách mã sản phẩm', en: 'Missing product ids' }
				},
				400
			);
		}

		// allSettled: 1 id fail (vd còn biến thể) không chặn các id còn lại.
		const settled = await Promise.allSettled(ids.map((id) => ProductAdminService.delete(actor, id)));
		let deleted = 0;
		for (const r of settled) {
			if (r.status === 'fulfilled' && r.value.success) deleted += 1;
		}

		if (deleted > 0) {
			void broadcastDbChange({ collection: 'products', action: 'delete', by: actor.userId });
		}

		return respond({
			ok: true,
			message: {
				vi: `Đã xoá ${deleted}/${ids.length} sản phẩm`,
				en: `Deleted ${deleted}/${ids.length} products`
			},
			data: {
				deleted,
				failed: ids.length - deleted
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/products/bulk]', e);
		const message = {
			vi: 'Xoá sản phẩm hàng loạt thất bại. Vui lòng thử lại.',
			en: 'Failed to delete products. Please try again.'
		};
		if (secureResponder) {
			return secureResponder({ ok: false, message }, 500);
		}
		return json({ message, ok: false }, { status: 500 });
	}
};
