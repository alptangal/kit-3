// src/routes/api/auth/webauthn/auth/options/+server.ts
// POST — sinh options đăng nhập passkey (PUBLIC — chưa đăng nhập).
// Body: { username? } — có username: ràng buộc allowCredentials theo user đó
// (không tiết lộ user có tồn tại: trả options "discoverable" khi không tìm thấy);
// không username: discoverable credential (authenticator tự chọn passkey).
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import {
	readPublicEncryptedRequest,
	respondPublicEncrypted
} from '$lib/server/admin/api';
import { WebAuthnService } from '$lib/server/db/webauthn';
import { applyRateLimit } from '$lib/server/rate-limit';

export const POST: RequestHandler = async (event) => {
	try {
		// Rate limit 10 req/min — chống dò challenge (config '/api/auth/webauthn')
		const rateLimited = await applyRateLimit(
			event.request,
			event.getClientAddress,
			event.url.pathname
		);
		if (rateLimited) return rateLimited;

		const read = await readPublicEncryptedRequest<Record<string, unknown>>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64, data } = read;

		const respond = (payload: Parameters<typeof respondPublicEncrypted>[1], status = 200) =>
			respondPublicEncrypted(publicKeyB64, payload, lang, status);

		// Blind index nếu có username (cùng chuẩn hoá với /api/login: trim + lowercase,
		// input chứa '@' → email)
		let usernameBlindIndex: string | undefined;
		let emailBlindIndex: string | undefined;
		const username = typeof data.username === 'string' ? data.username : undefined;
		if (username && systemVault?.indexKey) {
			const normalizedInput = username.trim().toLowerCase();
			const isEmailInput = normalizedInput.includes('@');
			if (isEmailInput) {
				emailBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, normalizedInput);
			} else {
				usernameBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, normalizedInput);
			}
		}

		const result = await WebAuthnService.generateAuthenticationOptions({
			usernameBlindIndex,
			emailBlindIndex
		});
		if (!result.success) {
			return respond({ ok: false, message: result.message }, 400);
		}

		return respond({ ok: true, data: { options: result.data?.options } });
	} catch (e) {
		console.error('[POST /api/auth/webauthn/auth/options]', e);
		return json(
			{ message: e instanceof Error ? e.message : String(e), ok: false },
			{ status: 500 }
		);
	}
};
