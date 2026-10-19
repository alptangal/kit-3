// src/routes/api/agent/keys/create/+server.ts
// POST { name } — tạo Secret Key mới CHO CHÍNH user (session).
// Response chứa raw key ĐÚNG 1 LẦN (data.key) — client hiển thị + bắt user copy;
// DB chỉ lưu keyHash. Bearer không được tự cấp key mới.
// fetchSecure contract: body mã hoá server-key, response mã hoá session-key.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { ApiKeyService } from '$lib/server/db/api-keys';

export const POST: RequestHandler = async (event) => {
	try {
		const read = await readAdminRequest<{ name?: string }>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64, data } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(event.locals);
		if (!actor) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}
		const name = typeof data.name === 'string' ? data.name : '';
		const result = await ApiKeyService.createOwn(actor, name);
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, 400);
		}
		return respond({ ok: true, data: result.data });
	} catch (e) {
		console.error('[POST /api/agent/keys/create]', e);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};
