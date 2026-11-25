// src/routes/api/admin/variants/bulk/+server.ts
// Bulk delete variants (bulk action từ checkbox DataTable — B54, mirror suppliers/bulk-delete).
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
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		const { ids } = read.data;
		if (!Array.isArray(ids) || ids.length === 0) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu danh sách mã biến thể', en: 'Missing variant ids' } },
				400
			);
		}

		// deleteVariant per-id: đã check tồn kho + permission từng row → allSettled
		// để 1 row fail (có tồn kho) không chặn các row còn lại.
		const results = await Promise.allSettled(ids.map((id) => ProductAdminService.deleteVariant(actor, id)));
		const deleted = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
		const failed = ids.length - deleted;

		return respond({
			ok: true,
			message:
				failed === 0
					? { vi: 'Xoá biến thể thành công', en: 'Variants deleted successfully' }
					: {
							vi: `Xoá ${deleted}/${ids.length} biến thể (${failed} lỗi, thường do biến thể còn tồn kho)`,
							en: `Deleted ${deleted}/${ids.length} variants (${failed} failed, usually due to stock on hand)`
						},
			data: { deleted, failed }
		});
	} catch (e) {
		console.error('[POST /api/admin/variants/bulk]', e);
		if (secureResponder) {
			return secureResponder(
				{
					ok: false,
					message: { vi: 'Xoá biến thể thất bại. Vui lòng thử lại.', en: 'Failed to delete variants. Please try again.' }
				},
				500
			);
		}
		return json(
			{
				ok: false,
				message: { vi: 'Xoá biến thể thất bại. Vui lòng thử lại.', en: 'Failed to delete variants. Please try again.' }
			},
			{ status: 500 }
		);
	}
};
