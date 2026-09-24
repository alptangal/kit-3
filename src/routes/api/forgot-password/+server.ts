// src\routes\api\forgot-password\+server.ts
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { json, type RequestHandler } from '@sveltejs/kit';
import type { ForgotPasswordRequestBody } from '../../(unauthorized)/forgot-password/_interface';
import type { ServerResponse } from '$interfaces/basic';
import { Users } from '$lib/server/db/users';
import { dev } from '$app/environment';
import { resolveLang, localizePayload } from '$lib/server/i18n';

const forgotPasswordMessages = {
	systemUnavailable: {
		vi: 'Hệ thống đang khởi tạo kho mã hoá — vui lòng thử lại sau',
		en: 'Service unavailable — system initializing'
	},
	missingSessionKey: {
		vi: 'Thiếu khoá phiên client (public key)',
		en: 'Missing session public key'
	},
	missingEmail: {
		vi: 'Vui lòng nhập địa chỉ email',
		en: 'Please enter your email address'
	},
	invalidEmail: {
		vi: 'Định dạng email không hợp lệ',
		en: 'Invalid email format'
	},
	emailNotRegistered: {
		vi: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi',
		en: 'If the email exists, a password reset link has been sent'
	},
	sendFailed: {
		vi: 'Gửi email thất bại, vui lòng thử lại sau',
		en: 'Failed to send email, please try again later'
	},
	success: {
		vi: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi',
		en: 'If the email exists, a password reset link has been sent'
	}
} as const;

export const POST: RequestHandler = async ({ request }) => {
	// Ngôn ngữ client yêu cầu — thu gọn mọi message về đúng 1 ngôn ngữ này
	const lang = resolveLang(request.headers.get('accept-language'));

	try {
		// 1. Kiểm tra systemVault đã sẵn sàng
		if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
			return json(
				localizePayload({ message: forgotPasswordMessages.systemUnavailable, ok: false }, lang),
				{ status: 503 }
			);
		}

		// 2. Giải mã payload request bằng privateKey của server
		const jsRaw = await request.json();
		const decryptedText = await encryption.decryptWithPrivateKeyHybrid(
			systemVault.privateKey,
			jsRaw
		);
		if (!decryptedText) {
			return json({ message: 'Decryption returned empty', ok: false }, { status: 400 });
		}

		// 3. Parse dữ liệu đã giải mã
		const dataDecrypted: ForgotPasswordRequestBody = JSON.parse(decryptedText);
		const { publicKeyB64, email } = dataDecrypted;

		if (!publicKeyB64) {
			return json(
				localizePayload({ message: forgotPasswordMessages.missingSessionKey, ok: false }, lang),
				{ status: 400 }
			);
		}
		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);

		const respond = async (payload: ServerResponse, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(
				sessionPublicKey,
				JSON.stringify(localizePayload(payload, lang))
			);
			return json(enc, { status });
		};

		// 4. Validate email
		if (!email?.trim()) {
			return respond({ message: forgotPasswordMessages.missingEmail, ok: false }, 400);
		}

		const normalizedEmail = email.trim().toLowerCase();
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(normalizedEmail)) {
			return respond({ message: forgotPasswordMessages.invalidEmail, ok: false }, 400);
		}

		// 5. Tính blind index để tra cứu email
		const emailBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, normalizedEmail);

		// 6. Kiểm tra email có tồn tại không
		const emailExists = await Users.isEmailTaken(emailBlindIndex);

		// Luôn trả về thành công để không tiết lộ thông tin tài khoản (security best practice)
		// Thực tế gửi email reset password sẽ được xử lý ở đây
		if (emailExists) {
			// TODO: Implement actual email sending with reset token
			// - Generate secure reset token
			// - Store token with expiry (1 hour)
			// - Send email with reset link
			console.log(`[FORGOT PASSWORD] Would send reset email to: ${normalizedEmail}`);
		}

		return respond(
			{
				ok: true,
				message: forgotPasswordMessages.success
			},
			200
		);
	} catch (e) {
		console.error('[POST /api/forgot-password]', e);
		return json(
			{ message: e instanceof Error ? e.message : String(e), ok: false },
			{ status: 500 }
		);
	}
};