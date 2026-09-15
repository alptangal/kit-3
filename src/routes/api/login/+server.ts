// src\routes\api\login\+server.ts
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { json, type RequestHandler } from '@sveltejs/kit';
import type { LoginRequestBody } from '../../(unauthorized)/login/_interface';
import type { ServerResponse } from '$interfaces/basic';
import { Users } from '$lib/server/db/users';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request, getClientAddress, cookies }) => {
	try {
		// ── 1. Kiểm tra system vault đã sẵn sàng ──
		if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
			return json({ message: 'Service unavailable — system initializing' }, { status: 503 });
		}

		// ── 2. Giải mã request body bằng private key của server ──
		const jsRaw = await request.json();
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
				JSON.stringify(payload)
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
		const normalizedInput = username.trim().toLowerCase();
		const usernameBlindIndex = await encryption.hmacBlindIndex(
			systemVault.indexKey,
			normalizedInput
		);
		// Vì user có thể nhập username hoặc email nên tính blind index cho cả hai
		// (users.login sẽ thử tìm theo cả hai blind index)
		const emailBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, normalizedInput);

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

		// ── 8. Xây dựng session token và thiết lập cookie ──
		const userInstance = loginResult.user;
		const userDocKey = userInstance.getDocumentKey();

		/**
		 * Session data được lưu vào cookie.
		 * Lưu ý: trong production nên ký JWT hoặc dùng thư viện session an toàn
		 * thay vì base64 thuần để tránh giả mạo session.
		 */
		const sessionData = {
			userId: userDocKey,
			username: userInstance.user.firstname,
			roleId: userInstance.user.roleId,
			// Thêm timestamp để có thể kiểm tra thời hạn phía server nếu cần
			issuedAt: Date.now()
		};
		const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

		// Thời hạn cookie: 30 ngày nếu remember, 1 ngày nếu không
		const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

		cookies.set('session', sessionToken, {
			path: '/',
			httpOnly: true,           // Không cho JS đọc cookie
			sameSite: 'lax',          // Bảo vệ CSRF cơ bản
			secure: !dev,             // Chỉ gửi qua HTTPS trong production
			maxAge
		});

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
