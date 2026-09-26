// src/routes/api/admin/users/reset-password/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { UserAdminService } from '$lib/server/db/users';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ documentKey: string; newPassword: string }>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

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

		const { documentKey, newPassword } = read.data;
		if (!documentKey || !newPassword) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu documentKey hoặc mật khẩu mới',
						en: 'Missing documentKey or new password'
					}
				},
				400
			);
		}

		const result = await UserAdminService.resetPassword(actor, documentKey, newPassword);
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({ ok: true, message: result.messages });
	} catch (e) {
		console.error('[POST /api/admin/users/reset-password]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
