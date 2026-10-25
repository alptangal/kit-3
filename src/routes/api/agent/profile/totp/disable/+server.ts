// src/routes/api/agent/profile/totp/disable/+server.ts
// POST { code } — xác minh mã rồi TẮT 2FA (xoá secret + enabled).

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { Users } from '$lib/server/db/users';
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { verifyTotpCode } from '$lib/server/totp';

export const POST: RequestHandler = async (event) => {
	try {
		const read = await readAdminRequest<{ code?: unknown }>(event);
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

		const user = await Users.getById(actor.userId);
		if (!user || !user.user.totpEnabled) {
			return respond(
				{
					ok: false,
					message: { vi: '2FA chưa được bật', en: '2FA is not enabled' }
				},
				400
			);
		}

		const code = typeof data.code === 'string' ? data.code : '';
		const secretEnc = user.user.totpSecretEncrypted;
		if (secretEnc) {
			const secret = await encryption.decryptWithIndexKey(systemVault.indexKey, secretEnc);
			if (!verifyTotpCode(secret, code)) {
				return respond(
					{
						ok: false,
						message: {
							vi: 'Mã xác minh không đúng — thử lại',
							en: 'Invalid verification code — try again'
						}
					},
					400
				);
			}
		}

		const inst = user as unknown as {
			user: Record<string, unknown>;
			save: () => Promise<{ success: boolean }>;
		};
		inst.user.totpEnabled = false;
		inst.user.totpSecretEncrypted = undefined;
		inst.user.totpCreatedAt = undefined;
		const saved = await inst.save();
		if (!saved.success) {
			return respond(
				{ ok: false, message: { vi: 'Không tắt được 2FA', en: 'Failed to disable 2FA' } },
				500
			);
		}

		return respond({ ok: true });
	} catch (e) {
		console.error('[POST /api/agent/profile/totp/disable]', e);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};
