// src/routes/api/agent/keys/list/+server.ts
// POST — danh sách Secret Key CỦA CHÍNH user (session). Bearer không được
// quản lý key qua chính nó (chỉ dùng gọi API dữ liệu) → chỉ session.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getActorContext } from '$lib/server/admin/api';
import { ApiKeyService } from '$lib/server/db/api-keys';
import { resolveLang, localize } from '$lib/server/i18n';

export const POST: RequestHandler = async (event) => {
	const lang = resolveLang(event.request.headers.get('accept-language'));
	try {
		const actor = await getActorContext(event.locals);
		if (!actor) {
			return json(
				{ ok: false, message: localize({ vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' }, lang) },
				{ status: 401 }
			);
		}
		const result = await ApiKeyService.listOwn(actor);
		if (!result.success) {
			return json({ ok: false, message: localize(result.messages, lang) }, { status: 400 });
		}
		return json({ ok: true, data: result.data });
	} catch (e) {
		console.error('[POST /api/agent/keys/list]', e);
		return json(
			{ ok: false, message: localize({ vi: 'Lỗi máy chủ', en: 'Server error' }, lang) },
			{ status: 500 }
		);
	}
};
