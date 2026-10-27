// src/lib/server/totp-guard.ts
// Guard dùng chung cho các endpoint nhạy cảm bắt buộc 2FA (change-password,
// keys/create, keys/revoke): nếu user đã bật TOTP mà request thiếu/sai mã 6 số
// → trả Response lỗi (400 thiếu / 401 sai) để route return thẳng.
// Contract với client (đã chốt): body kèm `totpCode?: string` khi 2FA bật.

import { respondEncrypted } from '$lib/server/admin/api';
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { verifyTotpCode } from '$lib/server/totp';
import type { Users } from '$lib/server/db/users';
import type { LanguageCode, ServerResponse } from '$interfaces/basic';

/**
 * Kiểm tra mã TOTP cho actor đang thao tác.
 * - User chưa bật 2FA → { ok: true } (hành vi như cũ, không yêu cầu mã).
 * - Đã bật mà thiếu totpCode → 400 "Cần mã xác thực 2 bước".
 * - Đã bật mà mã sai → 401 "Mã xác thực không đúng".
 *
 * @param user          Users instance của actor (đã getById)
 * @param code          giá trị data.totpCode từ body (có thể undefined)
 * @param publicKeyB64  public key phiên client (respondEncrypted)
 * @param lang          ngôn ngữ client yêu cầu
 */
export async function requireTotpCode(
	user: Users,
	code: string | undefined,
	publicKeyB64: string,
	lang: LanguageCode
): Promise<{ ok: true } | { ok: false; response: Response }> {
	// Không bật 2FA — bỏ qua guard
	if (!user.user.totpEnabled) return { ok: true };

	const respond = (payload: ServerResponse, status: number) =>
		respondEncrypted(publicKeyB64, payload, lang, status);

	if (!code) {
		return {
			ok: false,
			response: await respond(
				{
					ok: false,
					message: { vi: 'Cần mã xác thực 2 bước', en: '2FA code required' }
				},
				400
			)
		};
	}

	if (!user.user.totpSecretEncrypted) {
		// Bật 2FA nhưng mất secret (lỗi dữ liệu) — coi như mã sai, không leak chi tiết
		return {
			ok: false,
			response: await respond(
				{
					ok: false,
					message: { vi: 'Mã xác thực không đúng', en: 'Invalid verification code' }
				},
				401
			)
		};
	}

	const secret = await encryption.decryptWithIndexKey(
		systemVault.indexKey,
		user.user.totpSecretEncrypted
	);
	if (!verifyTotpCode(secret, code)) {
		return {
			ok: false,
			response: await respond(
				{
					ok: false,
					message: { vi: 'Mã xác thực không đúng', en: 'Invalid verification code' }
				},
				401
			)
		};
	}

	return { ok: true };
}
