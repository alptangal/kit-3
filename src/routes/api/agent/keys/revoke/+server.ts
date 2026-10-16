// src/routes/api/agent/keys/revoke/+server.ts
// POST { documentKey } — thu hồi (soft) key CỦA CHÍNH user (session).
// Bearer không được thu hồi key (chặn escalate tự huỷ lẫn nhau).

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
		let documentKey: string | undefined;
		try {
			const body = (await event.request.json()) as { documentKey?: string };
			documentKey = body?.documentKey;
		} catch {
			documentKey = undefined;
		}
		if (!documentKey || typeof documentKey !== 'string') {
			return json(
				{ ok: false, message: localize({ vi: 'Thiếu documentKey', en: 'Missing documentKey' }, lang) },
				{ status: 400 }
			);
		}
		const result = await ApiKeyService.revokeOwn(actor, documentKey);
		if (!result.success) {
			return json({ ok: false, message: localize(result.messages, lang) }, { status: 400 });
		}
		return json({ ok: true, data: result.data });
	} catch (e) {
		console.error('[POST /api/agent/keys/revoke]', e);
		return json(
			{ ok: false, message: localize({ vi: 'Lỗi máy chủ', en: 'Server error' }, lang) },
			{ status: 500 }
		);
	}
};
