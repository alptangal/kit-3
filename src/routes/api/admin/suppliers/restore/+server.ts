// src/routes/api/admin/suppliers/restore/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { broadcastDbChange } from '$lib/server/db-broadcast';
import { SupplierService } from '$lib/server/db/suppliers';

// POST /api/admin/suppliers/restore — khôi phục supplier về giá trị trước 1 entry lịch sử.
export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ supplierId: string; historyId: string }>(event);
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

		if (!read.data.supplierId || !read.data.historyId) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu supplierId hoặc historyId', en: 'Missing supplierId or historyId' } },
				400
			);
		}

		const result = await SupplierService.restoreSupplierFromHistory(
			actor,
			read.data.supplierId,
			read.data.historyId
		);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		void broadcastDbChange({ collection: 'suppliers', action: 'restore', by: actor?.userId });

		return respond({
			ok: true,
			message: { vi: 'Khôi phục nhà cung cấp thành công', en: 'Supplier restored successfully' },
			data: result.supplier
		});
	} catch (e) {
		console.error('[POST /api/admin/suppliers/restore]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
