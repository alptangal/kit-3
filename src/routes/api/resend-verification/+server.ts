import { json, type RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { cbData } from '$modules/couchbase/clients';
import type { ServerResponse } from '$interfaces/basic';
import { Users } from '$lib/server/db/users';
import type { User } from '$modules/schema';
import { sendDevEmail } from '$lib/server/email';
import { resolveLang, localizePayload } from '$lib/server/i18n';

const cbUsers = cbData('users');

const resendVerificationMessages = {
	systemUnavailable: { vi: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.', en: 'The system is under maintenance. Please try again later.' },
	invalidBody: { vi: 'Dữ liệu không hợp lệ.', en: 'Invalid data.' },
	missingSessionKey: { vi: 'Thiếu khóa phiên. Vui lòng tải lại trang.', en: 'Missing session key. Please reload the page.' },
	invalidEmail: { vi: 'Email không hợp lệ.', en: 'Invalid email.' },
	tooManyRequests: { vi: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', en: 'Too many requests. Please try again later.' },
	// Anti-enumeration: message success giống hệt dù email tồn tại hay không
	success: { vi: 'Nếu email tồn tại, liên kết xác nhận đã được gửi.', en: 'If the email exists, a verification link has been sent.' }
};

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

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const lang = resolveLang(request.headers.get('accept-language'));
	try {
		if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
			return json({ message: localizePayload({ ok: false, message: resendVerificationMessages.systemUnavailable }, lang) }, { status: 503 });
		}
		const jsRaw = await request.json();
		if (!jsRaw) {
			return json({ message: localizePayload({ ok: false, message: resendVerificationMessages.invalidBody }, lang) }, { status: 400 });
		}
		const decryptedText = await encryption.decryptWithPrivateKeyHybrid(systemVault.privateKey, jsRaw);
		if (!decryptedText) {
			return json({ message: localizePayload({ ok: false, message: resendVerificationMessages.invalidBody }, lang) }, { status: 400 });
		}
		const parsed = JSON.parse(decryptedText) as { email?: string; publicKeyB64?: string };
		const { publicKeyB64, email } = parsed;
		if (!publicKeyB64) {
			return json({ message: localizePayload({ ok: false, message: resendVerificationMessages.missingSessionKey }, lang) }, { status: 400 });
		}
		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);
		const respond = async (payload: ServerResponse, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(sessionPublicKey, JSON.stringify(localizePayload(payload, lang)));
			return json(enc, { status });
		};

		// Rate limit
		const rateLimitKey = `resend-verification:${getClientAddress()}`;
		const rateLimit = checkRateLimit(rateLimitKey);
		if (!rateLimit.allowed) {
			return respond({ ok: false, message: resendVerificationMessages.tooManyRequests }, 429);
		}

		if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			return respond({ ok: false, message: resendVerificationMessages.invalidEmail }, 400);
		}
		const normalizedEmail = email.trim().toLowerCase();

		// Anti-enumeration: nếu email tồn tại → gen token mới + gửi; response GIỐNG HỆT cả hai nhánh.
		// Lỗi trong nhánh gửi (DB/search fail) bị nuốt — response vẫn là success chung.
		try {
			const emailBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, normalizedEmail);
			const emailExists = await Users.isEmailTaken(emailBlindIndex);
			if (emailExists) {
				const found = await Users.getBy({ emailBlindIndex });
				const doc = (found ?? []).find((d) => !d.deletedAt) ?? (found ?? [])[0];
				if (doc?._id) {
					const rawToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
					const tokenHash = await encryption.getDataHash(rawToken);
					cbUsers.document
						.update({ documentKey: doc._id, content: { emailVerificationTokenHash: tokenHash } as Partial<User> as User })
						.catch((e) => console.error('[resend-verification] save token failed', e));
					const baseUrl = dev ? 'https://localhost:3000' : `https://${request.headers.get('host')}`;
					const verifyUrl = `${baseUrl}/verify-email?token=${rawToken}`;
					sendDevEmail(normalizedEmail, 'Xác nhận email / Verify your email', `<p>Nhấn liên kết để xác nhận email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`);
				}
			}
		} catch (inner) {
			// Nuốt lỗi lookup/gửi — không được tiết lộ email có tồn tại hay không qua response khác nhau
			console.error('[resend-verification] lookup/send failed:', inner);
		}

		return respond({ ok: true, message: resendVerificationMessages.success }, 200);
	} catch (e) {
		console.error('[resend-verification] error:', e);
		return json({ message: localizePayload({ ok: false, message: resendVerificationMessages.systemUnavailable }, lang) }, { status: 500 });
	}
};
