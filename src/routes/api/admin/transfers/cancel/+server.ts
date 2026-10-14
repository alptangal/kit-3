// src/routes/api/admin/transfers/cancel/+server.ts
// Huỷ phiếu: pending → cancelled (không đổi kho) / in_transit → cancelled (hoàn kho gốc).
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { TransferService } from '$lib/server/db/transfers';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ transferId: string }>(event);
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

		if (!read.data.transferId) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu mã phiếu chuyển kho', en: 'Missing transfer id' } },
				400
			);
		}

		const result = await TransferService.cancel(actor, read.data.transferId);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Đã huỷ phiếu chuyển kho', en: 'Transfer cancelled' },
			data: { transfer: result.transfer }
		});
	} catch (e) {
		console.error('[POST /api/admin/transfers/cancel]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
