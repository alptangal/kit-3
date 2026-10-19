// src/routes/api/admin/purchases/update/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SupplierService } from '$lib/server/db/suppliers';

// POST /api/admin/purchases/update — detail modal edit (chỉ draft).
export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			poId: string;
			patch: Record<string, unknown>;
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

		if (!read.data.poId || typeof read.data.patch !== 'object' || read.data.patch === null) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu poId hoặc patch',
						en: 'Missing poId or patch'
					}
				},
				400
			);
		}

		const result = await SupplierService.updatePurchaseOrder(actor, read.data.poId, read.data.patch);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Cập nhật phiếu nhập hàng thành công', en: 'Purchase order updated successfully' },
			data: result.po
		});
	} catch (e) {
		console.error('[POST /api/admin/purchases/update]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
