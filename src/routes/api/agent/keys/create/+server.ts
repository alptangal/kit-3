// src/routes/api/agent/keys/create/+server.ts
// POST { name } — tạo Secret Key mới CHO CHÍNH user (session).
// Response chứa raw key ĐÚNG 1 LẦN (data.key) — client hiển thị + bắt user copy;
// DB chỉ lưu keyHash. Bearer không được tự cấp key mới.

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
		let name: string | undefined;
		try {
			const body = (await event.request.json()) as { name?: string };
			name = body?.name;
		} catch {
			name = undefined;
		}
		const result = await ApiKeyService.createOwn(actor, name ?? '');
		if (!result.success) {
			return json({ ok: false, message: localize(result.messages, lang) }, { status: 400 });
		}
		return json({ ok: true, data: result.data });
	} catch (e) {
		console.error('[POST /api/agent/keys/create]', e);
		return json(
			{ ok: false, message: localize({ vi: 'Lỗi máy chủ', en: 'Server error' }, lang) },
			{ status: 500 }
		);
	}
};
