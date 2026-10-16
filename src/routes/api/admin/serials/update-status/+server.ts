// src/routes/api/admin/serials/update-status/+server.ts
// Đổi trạng thái serial/IMEI thủ công: defective / khôi phục về in_stock / đánh dấu sold-returned...
// Permission: inventory:manage (SerialService.updateStatus tự check + scope own_branch).
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SerialService, SERIAL_STATUSES, type SerialStatus } from '$lib/server/db/serials';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;
	try {
		const read = await readAdminRequest<{ documentKey?: string; status?: string; notes?: string }>(event);
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

		const documentKey = (read.data.documentKey ?? '').trim();
		const status = (read.data.status ?? '').trim() as SerialStatus;
		if (!documentKey || !SERIAL_STATUSES.includes(status)) {
			return respond(
				{ ok: false, message: { vi: 'Dữ liệu không hợp lệ', en: 'Invalid data' } },
				400
			);
		}

		const result = await SerialService.updateStatus(actor, documentKey, status, read.data.notes?.trim() || undefined);
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}
		return respond({ ok: true, message: result.messages });
	} catch (e) {
		console.error('[POST /api/admin/serials/update-status]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
