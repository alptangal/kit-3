// src/routes/api/agent/keys/revoke/+server.ts
// POST { documentKey } — thu hồi (soft) key CỦA CHÍNH user (session).
// Bearer không được thu hồi key (chặn escalate tự huỷ lẫn nhau).
// fetchSecure contract: body mã hoá server-key, response mã hoá session-key.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { ApiKeyService } from '$lib/server/db/api-keys';

export const POST: RequestHandler = async (event) => {
	try {
		const read = await readAdminRequest<Record<string, unknown>>(event);
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
		const documentKey = typeof data.documentKey === 'string' ? data.documentKey : '';
		if (!documentKey) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu documentKey', en: 'Missing documentKey' } },
				400
			);
		}
		const result = await ApiKeyService.revokeOwn(actor, documentKey);
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, 400);
		}
		return respond({ ok: true, data: result.data });
	} catch (e) {
		console.error('[POST /api/agent/keys/revoke]', e);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};
