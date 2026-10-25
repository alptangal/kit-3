// src/routes/api/agent/profile/totp/setup/+server.ts
// POST — sinh TOTP secret mới (chưa bật), trả secret + otpauth URI để user quét QR.
// Secret lưu totpSecretEncrypted NGAY (totpEnabled=false) — enable yêu cầu verify
// code; nếu user bỏ dở thì setup lại ghi đè, không có secret mồ côi bật dở.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { Users } from '$lib/server/db/users';
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { generateTotpSecret, buildOtpauthUrl } from '$lib/server/totp';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async (event) => {
	try {
		const read = await readAdminRequest<Record<string, unknown>>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

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
		if (!user) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

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
				{ ok: false, message: { vi: 'Không khởi tạo được 2FA', en: 'Failed to set up 2FA' } },
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
		console.error('[POST /api/agent/profile/totp/setup]', e);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};
