// src/routes/api/admin/suppliers/update/+server.ts
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

// POST /api/admin/suppliers/update — info modal sửa supplier từ purchase detail.
export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			supplierId: string;
			patch: Record<string, unknown>;
		}>(event);
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

		if (!read.data.supplierId || typeof read.data.patch !== 'object' || read.data.patch === null) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu supplierId hoặc patch', en: 'Missing supplierId or patch' } },
				400
			);
		}

		const result = await SupplierService.updateSupplier(actor, read.data.supplierId, read.data.patch);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		void broadcastDbChange({ collection: 'suppliers', action: 'update', by: actor?.userId });

		return respond({
			ok: true,
			message: { vi: 'Cập nhật nhà cung cấp thành công', en: 'Supplier updated successfully' },
			data: result.supplier
		});
	} catch (e) {
		console.error('[POST /api/admin/suppliers/update]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
