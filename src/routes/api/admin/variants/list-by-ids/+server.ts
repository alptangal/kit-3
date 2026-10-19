// src/routes/api/admin/variants/list-by-ids/+server.ts
// POST { ids: string[] } → items variant + productName (JOIN product).
// Dùng bởi trang purchases để hiển thị tên sản phẩm/phân loại thay vì id.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { ProductAdminService } from '$lib/server/db/products';

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
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		if (!Array.isArray(read.data.ids)) {
			return respond(
				{ ok: false, message: { vi: 'Dữ liệu không hợp lệ', en: 'Invalid input' } },
				400
			);
		}

		const result = await ProductAdminService.listVariantsByIds(actor, read.data.ids);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Lấy danh sách biến thể thành công', en: 'Variant list fetched successfully' },
			data: { items: result.items }
		});
	} catch (e) {
		console.error('[POST /api/admin/variants/list-by-ids]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
