// src/routes/api/admin/webauthn/rename/+server.ts
// POST — đổi tên hiển thị của 1 passkey (chỉ chủ sở hữu).
// Body: { credentialId, name }
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { WebAuthnService } from '$lib/server/db/webauthn';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<Record<string, unknown>>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64, data } = read;

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

		const credentialId = typeof data.credentialId === 'string' ? data.credentialId : undefined;
		const name = typeof data.name === 'string' ? data.name : undefined;
		if (!credentialId || typeof name !== 'string') {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu thông tin thiết bị hoặc tên mới',
						en: 'Missing credential or new name'
					}
				},
				400
			);
		}

		const result = await WebAuthnService.renameCredential(actor, credentialId, name);
		if (!result.success) {
			return respond({ ok: false, message: result.message }, 400);
		}

		return respond({
			ok: true,
			message: result.message,
			data: { credential: result.data }
		});
	} catch (e) {
		console.error('[POST /api/admin/webauthn/rename]', e);
		return json(
			{ message: e instanceof Error ? e.message : String(e), ok: false },
			{ status: 500 }
		);
	}
};
