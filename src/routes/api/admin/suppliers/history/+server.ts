// src/routes/api/admin/suppliers/history/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SupplierService } from '$lib/server/db/suppliers';

// POST /api/admin/suppliers/history — timeline lịch sử thay đổi của 1 supplier.
export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	let secureResponder:
		| ((payload: Parameters<typeof respondEncrypted>[1], status?: number) => Promise<Response>)
		| undefined;
	try {
		const read = await readAdminRequest<{ supplierId: string }>(event);
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

		if (!read.data.supplierId) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu supplierId', en: 'Missing supplierId' } },
				400
			);
		}

		const result = await SupplierService.listSupplierHistory(actor, read.data.supplierId);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Lấy lịch sử thành công', en: 'History fetched successfully' },
			data: { entries: result.entries }
		});
	} catch (e) {
		console.error('[POST /api/admin/suppliers/history]', e);
		if (secureResponder) {
			return secureResponder(
				{ ok: false, message: { vi: 'Tải lịch sử thất bại. Vui lòng thử lại.', en: 'Failed to load history. Please try again.' } },
				500
			);
		}
		return json({ message: { vi: 'Tải lịch sử thất bại. Vui lòng thử lại.', en: 'Failed to load history. Please try again.' }, ok: false }, { status: 500 });
	}
};
