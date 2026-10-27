// src/routes/api/login/totp/+server.ts
// Bước 2 của login 2 lớp: POST { code } — verify mã TOTP rồi cấp session thật.
// Request/response dùng CÙNG cơ chế mã hoá hybrid với /api/login (fetchSecure).
// Cookie 'totp_challenge' (JWT purpose='totp', 5 phút) do bước 1 cấp — token này
// KHÔNG phải session: hooks.server.ts từ chối mọi JWT có field 'purpose'.
// Rate limit: getConfig() prefix-match '/api/login' → 5 req/min, dùng chung config
// bước 1 (không cần thêm config mới). Thử sai KHÔNG xoá challenge (cho retry);
// chống brute-force ở tầng rate-limit theo IP (5/phút là đủ với mã 6 số + window ±1).

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import type { ServerResponse } from '$interfaces/basic';
import type { LoginRequestBody } from '../../../(unauthorized)/login/_interface';
import { Users } from '$lib/server/db/users';
import { cbData } from '$modules/couchbase/clients';
import type { User } from '$modules/schema';
import { dev } from '$app/environment';
import { resolveLang, localizePayload } from '$lib/server/i18n';
import { signAccessToken, verifyAccessToken } from '$lib/server/jwt';
import { createRefreshToken } from '$lib/server/db/tokens';
import { calculateJwkThumbprint } from '$lib/dpop/thumbprint';
import { getClientIp, applyRateLimit } from '$lib/server/rate-limit';
import { verifyTotpCode } from '$lib/server/totp';

const cbUsers = cbData('users');
const cbUserStatus = cbData('user_status');

export const POST: RequestHandler = async ({ request, getClientAddress, cookies, url }) => {
	// Ngôn ngữ client yêu cầu — thu gọn mọi message về đúng 1 ngôn ngữ này
	const lang = resolveLang(request.headers.get('accept-language'));

	try {
		// ── 0. Rate limit (dùng chung config '/api/login' 5 req/min qua prefix match) ──
		const rateLimited = await applyRateLimit(request, getClientAddress, url.pathname);
		if (rateLimited) return rateLimited;

		// ── 1. Kiểm tra system vault đã sẵn sàng ──
		if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
			return json({ message: 'Service unavailable — system initializing' }, { status: 503 });
		}

		// ── 2. Giải mã request body bằng private key của server (như login bước 1) ──
		const jsRaw = (await request.json()) as { encryptedSessionKeyB64: string; ivB64: string; ciphertextB64: string };
		const decryptedText = await encryption.decryptWithPrivateKeyHybrid(systemVault.privateKey, jsRaw);
		if (!decryptedText) {
			return json({ message: 'Decryption returned empty' }, { status: 400 });
		}
		const dataDecrypted: LoginRequestBody & { code?: unknown } = JSON.parse(decryptedText);
		const { publicKeyB64 } = dataDecrypted;
		if (!publicKeyB64) {
			return json({ message: 'Missing session public key' }, { status: 400 });
		}

		// Import public key của client để mã hoá phản hồi
		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);

		const respond = async (payload: ServerResponse, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(
				sessionPublicKey,
				JSON.stringify(localizePayload(payload, lang))
			);
			return json(enc, { status });
		};

		// ── 3. Đọc + verify challenge cookie ──
		const challenge = cookies.get('totp_challenge');
		if (!challenge) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Phiên xác thực 2 bước đã hết hạn — hãy đăng nhập lại',
						en: '2FA challenge expired — please log in again'
					}
				},
				401
			);
		}
		let payload: Record<string, any>;
		try {
			payload = await verifyAccessToken(challenge);
		} catch {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Phiên xác thực 2 bước đã hết hạn — hãy đăng nhập lại',
						en: '2FA challenge expired — please log in again'
					}
				},
				401
			);
		}
		// Chỉ nhận JWT đúng mục đích — session token (không có purpose) bị loại
		if (payload.purpose !== 'totp' || typeof payload.sub !== 'string' || !payload.sub) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Phiên xác thực 2 bước đã hết hạn — hãy đăng nhập lại',
						en: '2FA challenge expired — please log in again'
					}
				},
				401
			);
		}

		// ── 4. Tải user + kiểm tra còn đăng nhập được (chưa xoá, status còn canLogin) ──
		const userInstance = await Users.getById(payload.sub);
		if (!userInstance || userInstance.user.deletedAt) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Tài khoản không khả dụng',
						en: 'Account is not available'
					}
				},
				401
			);
		}
		// canLogin là private static của Users — tra trực tiếp user_status tại đây
		const statusRes = await cbUserStatus.document.get({
			documentKey: userInstance.user.statusId as string
		});
		const canLogin = Boolean((statusRes.data as { canLogin?: boolean } | undefined)?.canLogin);
		if (!statusRes.ok || !statusRes.data || !canLogin) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Tài khoản đã bị khoá',
						en: 'Account is locked'
					}
				},
				401
			);
		}
		if (!userInstance.user.totpEnabled || !userInstance.user.totpSecretEncrypted) {
			// 2FA đã bị tắt giữa chừng (vd admin disable) — cho đăng nhập lại từ đầu
			cookies.delete('totp_challenge', { path: '/' });
			return respond(
				{
					ok: false,
					message: {
						vi: '2FA đã bị tắt — hãy đăng nhập lại',
						en: '2FA has been disabled — please log in again'
					}
				},
				401
			);
		}

		// ── 5. Verify mã TOTP ──
		const code = typeof dataDecrypted.code === 'string' ? dataDecrypted.code : '';
		const secret = await encryption.decryptWithIndexKey(
			systemVault.indexKey,
			userInstance.user.totpSecretEncrypted
		);
		if (!verifyTotpCode(secret, code)) {
			// SAI mã — giữ nguyên challenge để client cho nhập lại (không xoá cookie)
			return respond(
				{
					ok: false,
					message: { vi: 'Mã xác thực không đúng', en: 'Invalid verification code' }
				},
				401
			);
		}

		// ── 6. ĐÚNG mã — xoá challenge, cấp session Y hệt login bước thành công ──
		cookies.delete('totp_challenge', { path: '/' });

		// Ghi lastLoginAt/lastLoginIp — login 2 lớp giờ mới hoàn tất (fire-and-forget)
		const clientIp = (() => {
			try {
				return getClientAddress();
			} catch {
				return undefined;
			}
		})();
		cbUsers.document
			.update({
				documentKey: payload.sub,
				content: {
					lastLoginAt: new Date().toISOString(),
					lastLoginIp: clientIp ?? null
				} as Partial<User> as User
			})
			.catch((e) => console.error('[POST /api/login/totp] update lastLoginAt failed', e));

		// Ký JWT session như login route (remember mặc định false — bước 2 không nhận remember)
		const iat = Math.floor(Date.now() / 1000);
		const sessionToken = await signAccessToken({
			sub: payload.sub,
			username: userInstance.user.firstname,
			roleId: userInstance.user.roleId,
			statusId: userInstance.user.statusId,
			iat,
			exp: iat + 86400
		});
		cookies.set('session', sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 60 * 24
		});

		// ── 6b. Refresh token + DPoP bind (giống login route) ──
		if (dataDecrypted.dpopJwk?.x && dataDecrypted.dpopJwk?.y) {
			try {
				const jkt = await calculateJwkThumbprint(dataDecrypted.dpopJwk);
				const refreshTokenValue = crypto.randomUUID() + crypto.randomUUID();
				const created = await createRefreshToken({
					userId: payload.sub,
					token: refreshTokenValue,
					jkt,
					expiresAt: Math.floor(Date.now() / 1000) + 30 * 86400,
					deviceId: crypto.randomUUID(),
					ipAddress: getClientIp(request, getClientAddress),
					userAgent: request.headers.get('user-agent') ?? ''
				});
				if (created.success) {
					cookies.set('refreshToken', refreshTokenValue, {
						path: '/api/auth/refresh',
						httpOnly: true,
						sameSite: 'strict',
						secure: !dev,
						maxAge: 60 * 60 * 24 * 30
					});
				} else {
					console.error('[POST /api/login/totp] createRefreshToken failed:', created.messages);
				}
			} catch (e) {
				console.error('[POST /api/login/totp] refresh token error:', e);
			}
		}

		// ── 7. Phản hồi thành công — cùng shape login route ──
		return respond(
			{
				message: { vi: 'Đăng nhập thành công', en: 'Login successful' },
				ok: true,
				data: {
					user: {
						firstname: userInstance.user.firstname,
						lastname: userInstance.user.lastname,
						roleId: userInstance.user.roleId,
						statusId: userInstance.user.statusId
					}
				}
			},
			200
		);
	} catch (e) {
		// Lỗi không mong đợi — không tiết lộ chi tiết ra ngoài
		console.error('[POST /api/login/totp]', e);
		return json({ message: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
