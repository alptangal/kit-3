// src/routes/api/agent/profile/totp/enable/+server.ts
// POST { code } — xác minh mã 6 số từ authenticator app, bật 2FA (totpEnabled=true).
// Yêu cầu đã gọi /totp/setup trước (có totpSecretEncrypted).

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
		if (!user || !user.user.totpSecretEncrypted) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Chưa khởi tạo 2FA — hãy quét mã QR trước',
						en: '2FA not set up yet — scan the QR code first'
					}
				},
				400
			);
		}

		const code = typeof data.code === 'string' ? data.code : '';
		const secret = await encryption.decryptWithIndexKey(
			systemVault.indexKey,
			user.user.totpSecretEncrypted
		);
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

		const inst = user as unknown as {
			user: Record<string, unknown>;
			save: () => Promise<{ success: boolean }>;
		};
		inst.user.totpEnabled = true;
		const saved = await inst.save();
		if (!saved.success) {
			return respond(
				{ ok: false, message: { vi: 'Không bật được 2FA', en: 'Failed to enable 2FA' } },
				500
			);
		}

		return respond({ ok: true });
	} catch (e) {
		console.error('[POST /api/agent/profile/totp/enable]', e);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};
