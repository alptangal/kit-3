// src/routes/api/agent/profile/totp/change/+server.ts
// POST { currentCode } — ĐỔI secret TOTP: verify mã hiện tại → sinh secret MỚI,
// trả secret + otpauth URI để user quét QR rồi gọi /totp/enable bằng mã mới
// (enable set totpEnabled=true lại như flow setup→enable thường).
// Trong khoảng change→enable, totpEnabled=false → login 2 lớp tạm bỏ qua 2FA.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { Users } from '$lib/server/db/users';
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { generateTotpSecret, buildOtpauthUrl, verifyTotpCode } from '$lib/server/totp';
import { env } from '$env/dynamic/private';

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

		const user = await Users.getById(actor.userId);
		if (!user || !user.user.totpEnabled || !user.user.totpSecretEncrypted) {
			return respond(
				{
					ok: false,
					message: {
						vi: '2FA chưa được bật',
						en: '2FA is not enabled'
					}
				},
				400
			);
		}

		// Verify mã hiện tại — chứng minh người đang đổi secret sở hữu authenticator
		const currentCode = typeof data.currentCode === 'string' ? data.currentCode : '';
		const currentSecret = await encryption.decryptWithIndexKey(
			systemVault.indexKey,
			user.user.totpSecretEncrypted
		);
		if (!verifyTotpCode(currentSecret, currentCode)) {
			return respond(
				{
					ok: false,
					message: { vi: 'Mã xác thực không đúng', en: 'Invalid verification code' }
				},
				401
			);
		}

		// Sinh secret mới — ghi đè secret cũ, tắt enabled (đợi enable bằng mã mới)
		const secret = generateTotpSecret();
		const enc = await encryption.encryptWithIndexKey(systemVault.indexKey, secret);
		const inst = user as unknown as {
			user: Record<string, unknown>;
			save: () => Promise<{ success: boolean }>;
		};
		inst.user.totpSecretEncrypted = enc;
		inst.user.totpEnabled = false;
		inst.user.totpCreatedAt = new Date().toISOString();
		const saved = await inst.save();
		if (!saved.success) {
			return respond(
				{ ok: false, message: { vi: 'Không đổi được 2FA', en: 'Failed to change 2FA' } },
				500
			);
		}

		const account = String(inst.user.username ?? inst.user.emailEncrypted ?? actor.userId);
		const issuer = env.webauthn_rp_name || 'PhuongDoMega';
		return respond({
			ok: true,
			data: { secret, otpauthUrl: buildOtpauthUrl(secret, account, issuer) }
		});
	} catch (e) {
		console.error('[POST /api/agent/profile/totp/change]', e);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};
