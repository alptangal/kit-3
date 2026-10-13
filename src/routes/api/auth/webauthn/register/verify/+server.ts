// src/routes/api/auth/webauthn/register/verify/+server.ts
// POST — verify attestation response sau navigator.credentials.create().
// Yêu cầu session. Body: { userId, response (RegistrationResponseJSON), name? }.
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
		const response = data.response;
		const name = typeof data.name === 'string' ? data.name : undefined;
		if (!userId || !response || typeof response !== 'object') {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu dữ liệu xác thực thiết bị',
						en: 'Missing device verification data'
					}
				},
				400
			);
		}

		const result = await WebAuthnService.verifyRegistration(actor, userId, response, name);
		if (!result.success) {
			return respond({ ok: false, message: result.message }, 400);
		}

		return respond({
			ok: true,
			message: result.message,
			data: { credential: result.data }
		});
	} catch (e) {
		console.error('[POST /api/auth/webauthn/register/verify]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
