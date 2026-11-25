// src/routes/api/admin/categories/bulk/+server.ts
// Xóa hàng loạt category (bulk action từ checkbox DataTable — Batch 54, đồng bộ suppliers).
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
					message: { vi: 'Thiếu danh sách mã danh mục', en: 'Missing category ids' }
				},
				400
			);
		}

		// deleteCategory từng id — allSettled để id lỗi (con/product đang dùng) không
		// chặn các id còn lại; đếm theo result.success của từng promise.
		const results = await Promise.allSettled(
			ids.map((id) => ProductAdminService.deleteCategory(actor, id))
		);
		let deleted = 0;
		let lastFailure: (typeof results)[number] | undefined;
		for (const r of results) {
			if (r.status === 'fulfilled' && r.value?.success) {
				deleted += 1;
			} else {
				lastFailure = r;
			}
		}

		if (deleted === 0 && lastFailure) {
			const messages =
				lastFailure.status === 'fulfilled'
					? lastFailure.value?.messages
					: { vi: 'Xoá thất bại', en: 'Delete failed' };
			if (messages) {
				return respond({ ok: false, message: messages }, statusForServiceFailure(messages));
			}
			return respond(
				{ ok: false, message: { vi: 'Xoá thất bại', en: 'Delete failed' } },
				400
			);
		}

		if (deleted > 0) {
			void broadcastDbChange({ collection: 'categories', action: 'delete', by: actor?.userId });
		}

		return respond({
			ok: true,
			message: { vi: 'Xoá danh mục thành công', en: 'Categories deleted' },
			data: {
				deleted,
				failed: ids.length - deleted
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/categories/bulk]', e);
		const failMessage = {
			vi: 'Xoá danh mục thất bại. Vui lòng thử lại.',
			en: 'Failed to delete categories. Please try again.'
		};
		if (secureResponder) {
			return secureResponder({ ok: false, message: failMessage }, 500);
		}
		return json({ message: failMessage, ok: false }, { status: 500 });
	}
};
