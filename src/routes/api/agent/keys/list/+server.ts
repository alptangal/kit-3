// src/routes/api/agent/keys/list/+server.ts
// POST — danh sách Secret Key CỦA CHÍNH user (session). Bearer không được
// quản lý key qua chính nó (chỉ dùng gọi API dữ liệu) → chỉ session.
// fetchSecure contract: body mã hoá server-key, response mã hoá session-key.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { ApiKeyService } from '$lib/server/db/api-keys';

export const POST: RequestHandler = async (event) => {
	try {
		const read = await readAdminRequest<Record<string, unknown>>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(event.locals);
		if (!actor) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}
		const result = await ApiKeyService.listOwn(actor);
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, 400);
		}
		return respond({ ok: true, data: result.data });
	} catch (e) {
		console.error('[POST /api/agent/keys/list]', e);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};
