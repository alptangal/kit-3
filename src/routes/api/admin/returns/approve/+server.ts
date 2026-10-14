// src/routes/api/admin/returns/approve/+server.ts
// Manager duyệt đổi trả: requested → approved.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { ReturnService } from '$lib/server/db/returns';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ returnId: string }>(event);
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

		if (!read.data.returnId) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu mã phiếu đổi trả', en: 'Missing return id' } },
				400
			);
		}

		const result = await ReturnService.approve(actor, read.data.returnId);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Đã duyệt phiếu đổi trả', en: 'Return approved' },
			data: { ret: result.ret }
		});
	} catch (e) {
		console.error('[POST /api/admin/returns/approve]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
