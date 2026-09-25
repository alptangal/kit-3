// src\routes\api\forgot-password\+server.ts
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { json, type RequestHandler } from '@sveltejs/kit';
import type { ForgotPasswordRequestBody } from '../../(unauthorized)/forgot-password/_interface';
import type { ServerResponse } from '$interfaces/basic';
import { Users } from '$lib/server/db/users';
import { dev } from '$app/environment';
import { resolveLang, localizePayload } from '$lib/server/i18n';
import { sendDevEmail } from '$lib/server/email';

// Rate limiting — sliding window (mirror api/register/check pattern)
const rateLimitWindowMs = 10_000;
const rateLimitMaxRequests = 15;
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
	const now = Date.now();
	const entry = rateLimitStore.get(identifier);
	if (!entry || now > entry.resetTime) {
		rateLimitStore.set(identifier, { count: 1, resetTime: now + rateLimitWindowMs });
		return { allowed: true, remaining: rateLimitMaxRequests - 1, resetTime: now + rateLimitWindowMs };
	}
	entry.count += 1;
	if (entry.count > rateLimitMaxRequests) {
		return { allowed: false, remaining: 0, resetTime: entry.resetTime };
	}
	return { allowed: true, remaining: rateLimitMaxRequests - entry.count, resetTime: entry.resetTime };
}

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
	tooManyRequests: {
		vi: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
		en: 'Too many requests. Please try again later.'
	},
	success: {
		vi: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi',
		en: 'If the email exists, a password reset link has been sent'
	}
} as const;

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
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

		// 4.5. Rate limit — chặn spam endpoint trước khi tốn blind-index lookup
		const rateLimitKey = `forgot-password:${getClientAddress()}`;
		const rateLimit = checkRateLimit(rateLimitKey);
		if (!rateLimit.allowed) {
			return respond({ ok: false, message: forgotPasswordMessages.tooManyRequests }, 429);
		}

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

		// 6. Kiểm tra email có tồn tại không — LUÔN trả success (anti-enumeration)
		const emailExists = await Users.isEmailTaken(emailBlindIndex);
		if (emailExists) {
			const found = Users.onlyActive(await Users.getBy({ emailBlindIndex }));
			const doc = found?.[0];
			if (doc?._id) {
				// Token: 2× UUID ghép (64 hex chars); DB chỉ lưu SHA-256 hash, token gốc chỉ trong link
				const rawToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
				const tokenHash = await encryption.getDataHash(rawToken);
				const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
				const saved = await Users.createPasswordResetToken(doc._id, tokenHash, expiresAt);
				if (saved) {
					const baseUrl = dev ? 'https://localhost:3000' : `https://${request.headers.get('host')}`;
					const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
					const html = `<p>Nhấn vào liên kết để đặt lại mật khẩu (hiệu lực 1 giờ):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`;
					sendDevEmail(normalizedEmail, 'Đặt lại mật khẩu / Password Reset', html);
				}
			}
		}

		// Anti-enumeration: message success giống hệt dù email có tồn tại hay không
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