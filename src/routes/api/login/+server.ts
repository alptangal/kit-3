// src\routes\api\login\+server.ts
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { json, type RequestHandler } from '@sveltejs/kit';
import type { LoginRequestBody } from '../../(unauthorized)/login/_interface';
import type { ServerResponse } from '$interfaces/basic';
import { Users } from '$lib/server/db/users';
import { dev } from '$app/environment';
import { resolveLang, localizePayload } from '$lib/server/i18n';
import { signAccessToken } from '$lib/server/jwt';
import { createRefreshToken } from '$lib/server/db/tokens';
import { calculateJwkThumbprint } from '$lib/dpop/thumbprint';
import { getClientIp } from '$lib/server/rate-limit';

export const POST: RequestHandler = async ({ request, getClientAddress, cookies }) => {
	// Ngôn ngữ client yêu cầu — thu gọn mọi message về đúng 1 ngôn ngữ này
	const lang = resolveLang(request.headers.get('accept-language'));

	try {
		// ── 1. Kiểm tra system vault đã sẵn sàng ──
		if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
			return json({ message: 'Service unavailable — system initializing' }, { status: 503 });
		}

		// ── 2. Giải mã request body bằng private key của server ──
		const jsRaw = (await request.json()) as { encryptedSessionKeyB64: string; ivB64: string; ciphertextB64: string };
		const decryptedText = await encryption.decryptWithPrivateKeyHybrid(
			systemVault.privateKey,
			jsRaw
		);
		if (!decryptedText) {
			return json({ message: 'Decryption returned empty' }, { status: 400 });
		}
		// ── 3. Parse dữ liệu đã giải mã ──
		const dataDecrypted: LoginRequestBody = JSON.parse(decryptedText);
		const { publicKeyB64 } = dataDecrypted;
		if (!publicKeyB64) {
			return json({ message: 'Missing session public key' }, { status: 400 });
		}

		// Import public key của client để mã hoá phản hồi
		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);

		/**
		 * Helper: mã hoá payload phản hồi bằng public key của client
		 * để đảm bảo chỉ client ban đầu đọc được
		 */
		const respond = async (payload: ServerResponse, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(
				sessionPublicKey,
				JSON.stringify(localizePayload(payload, lang))
			);
			return json(enc, { status });
		};

		const { password, username, remember } = dataDecrypted;

		// ── 4. Validate đầu vào cơ bản ──
		if (!username || !password) {
			return respond(
				{
					message: {
						vi: 'Không để trống tên đăng nhập hoặc mật khẩu',
						en: 'Username and password are required'
					},
					ok: false
				},
				400
			);
		}

		// ── 5. Tính blind index để tra cứu trong DB (hỗ trợ login bằng username hoặc email) ──
		// normalizedInput được chuẩn hoá về chữ thường + trim để đồng nhất với lúc tạo index
		// (createUser cũng .trim().toLowerCase() cho cả username lẫn email).
		// FIX: chỉ tính DUY NHẤT blind index tương ứng loại input. Trước đây cả hai
		// index đều tính từ cùng normalizedInput → khi login bằng EMAIL, getBy chọn
		// field 'usernameBlindIndex' (first-truthy-wins) so index của email với giá trị
		// username trong DB → không bao giờ match → "invalid credentials".
		const normalizedInput = username.trim().toLowerCase();
		const isEmailInput = normalizedInput.includes('@');
		const usernameBlindIndex = isEmailInput
			? undefined
			: await encryption.hmacBlindIndex(systemVault.indexKey, normalizedInput);
		const emailBlindIndex = isEmailInput
			? await encryption.hmacBlindIndex(systemVault.indexKey, normalizedInput)
			: undefined;

		// ── 6. Lấy IP client (optional, dùng cho audit log) ──
		let clientIp: string | undefined;
		try {
			clientIp = getClientAddress ? getClientAddress() : undefined;
		} catch {
			clientIp = undefined;
		}

		// ── 7. Xác thực đăng nhập qua domain class Users ──
		const loginResult = await Users.login(
			{
				usernameBlindIndex,
				emailBlindIndex,
				password
			},
			clientIp
		);

		if (!loginResult.success) {
			return respond(
				{
					message: loginResult.messages,
					ok: false
				},
				401
			);
		}

		// ── 8. Xây dựng JWT session token và thiết lập cookie ──
		const userInstance = loginResult.user;
		// getDocumentKey trả string | undefined — login thành công thì key luôn tồn tại
		const userDocKey = userInstance.getDocumentKey() as string;

		// Ký JWT access token (ES256) để hooks.server.ts verifyAccessToken() khớp
		const sessionPayload = {
			sub: userDocKey,
			username: userInstance.user.firstname,
			roleId: userInstance.user.roleId,
			statusId: userInstance.user.statusId,
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + (remember ? 30 * 86400 : 86400)
		};
		const sessionToken = await signAccessToken(sessionPayload);

		// Thời hạn cookie: 30 ngày nếu remember, 1 ngày nếu không
		const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

		cookies.set('session', sessionToken, {
			path: '/',
			httpOnly: true,           // Không cho JS đọc cookie
			sameSite: 'lax',          // Bảo vệ CSRF cơ bản
			secure: !dev,             // Chỉ gửi qua HTTPS trong production
			maxAge
		});

		// ── 8b. Cấp refresh token (token family mới) + bind DPoP key của client ──
		// Client gửi dpopJwk (ECDSA P-256) trong body — server tính thumbprint (jkt)
		// và lưu cùng refresh token; /api/auth/refresh sau này yêu cầu proof ký bằng
		// CÙNG khoá (jkt match) mới cấp access token mới.
		if (dataDecrypted.dpopJwk?.x && dataDecrypted.dpopJwk?.y) {
			try {
				const jkt = await calculateJwkThumbprint(dataDecrypted.dpopJwk);
				const refreshTokenValue = crypto.randomUUID() + crypto.randomUUID();
				const created = await createRefreshToken({
					userId: userDocKey,
					token: refreshTokenValue,
					jkt,
					expiresAt: Math.floor(Date.now() / 1000) + 30 * 86400,
					deviceId: crypto.randomUUID(),
					ipAddress: getClientIp(request, getClientAddress),
					userAgent: request.headers.get('user-agent') ?? ''
				});
				if (created.success) {
					// Cookie riêng path /api/auth/refresh — chỉ gửi khi client gọi refresh
					cookies.set('refreshToken', refreshTokenValue, {
						path: '/api/auth/refresh',
						httpOnly: true,
						sameSite: 'strict',
						secure: !dev,
						maxAge: 60 * 60 * 24 * 30
					});
				} else {
					// Không chặn login — session cookie vẫn hợp lệ, chỉ mất khả năng refresh
					console.error('[POST /api/login] createRefreshToken failed:', created.messages);
				}
			} catch (e) {
				console.error('[POST /api/login] refresh token error:', e);
			}
		}

		// ── 9. Trả về phản hồi thành công ──
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
		console.error('[POST /api/login]', e);
		return json(
			{ message: e instanceof Error ? e.message : String(e) },
			{ status: 500 }
		);
	}
};
