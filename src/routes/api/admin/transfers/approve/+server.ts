// src/routes/api/admin/transfers/approve/+server.ts
// Chi nhánh NHẬN duyệt: pending → in_transit (trừ kho chi nhánh gửi).
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

		const result = await TransferService.approve(actor, read.data.transferId);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: {
				vi: 'Duyệt phiếu chuyển kho thành công — hàng đang chuyển',
				en: 'Transfer approved — goods in transit'
			},
			data: { transfer: result.transfer }
		});
	} catch (e) {
		console.error('[POST /api/admin/transfers/approve]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
