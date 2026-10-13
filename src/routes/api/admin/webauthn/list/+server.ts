// src/routes/api/admin/webauthn/list/+server.ts
// POST — danh sách passkey của 1 user (owner tự xem, hoặc 'users:manage' xem giúp).
// Body: { userId }
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

		const userId = typeof data.userId === 'string' ? data.userId : undefined;
		if (!userId) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu thông tin người dùng',
						en: 'Missing user information'
					}
				},
				400
			);
		}

		const result = await WebAuthnService.listCredentials(actor, userId);
		if (!result.success) {
			return respond({ ok: false, message: result.message }, 400);
		}

		return respond({
			ok: true,
			data: { credentials: result.data?.credentials ?? [] }
		});
	} catch (e) {
		console.error('[POST /api/admin/webauthn/list]', e);
		return json(
			{ message: e instanceof Error ? e.message : String(e), ok: false },
			{ status: 500 }
		);
	}
};
