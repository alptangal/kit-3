// src/routes/api/register/check/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { Users } from '$lib/server/db/users';
import type { TranslateContent } from '$interfaces/basic';
import { resolveLang, localizePayload } from '$lib/server/i18n';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;
// Simple phone validator: +XX or local numbers, 6-21 chars of digits/spaces/dashes
const PHONE_REGEX = /^\+?[0-9][0-9\s\-]{5,20}$/;

// Rate limiting state (simple sliding window per client identifier)
const rateLimitWindowMs = 10_000; // 10 seconds
const rateLimitMaxRequests = 15;
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetTime: number;
}

function checkRateLimit(identifier: string): RateLimitResult {
	const now = Date.now();
	const entry = rateLimitStore.get(identifier);

	if (!entry || entry.resetTime <= now) {
		rateLimitStore.set(identifier, { count: 1, resetTime: now + rateLimitWindowMs });
		return { allowed: true, remaining: rateLimitMaxRequests - 1, resetTime: now + rateLimitWindowMs };
	}

	if (entry.count >= rateLimitMaxRequests) {
		return { allowed: false, remaining: 0, resetTime: entry.resetTime };
	}

	entry.count++;
	return { allowed: true, remaining: rateLimitMaxRequests - entry.count, resetTime: entry.resetTime };
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// Ngôn ngữ client yêu cầu — thu gọn mọi message về đúng 1 ngôn ngữ này
	const lang = resolveLang(request.headers.get('accept-language'));

	try {
		// 1. Kiểm tra systemVault đã sẵn sàng
		if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
			return json(
				localizePayload(
					{
						ok: false,
						message: {
							vi: 'Hệ thống đang khởi tạo kho mã hoá — vui lòng thử lại sau',
							en: 'Service unavailable — system initializing'
						}
					},
					lang
				),
				{ status: 503 }
			);
		}

		// 2. Giải mã request body từ client
		const jsRaw = await request.json();
		const decryptedText = await encryption.decryptWithPrivateKeyHybrid(
			systemVault.privateKey,
			jsRaw
		);

		if (!decryptedText) {
			return json({ message: 'Decryption returned empty', ok: false }, { status: 400 });
		}

		const dataDecrypted = JSON.parse(decryptedText) as {
			publicKeyB64?: string;
			username?: string;
			email?: string;
			phone?: string;
		};

		const { publicKeyB64, username, email, phone } = dataDecrypted;

		if (!publicKeyB64) {
			return json(
				localizePayload(
					{
						ok: false,
						message: {
							vi: 'Thiếu khoá phiên client (public key)',
							en: 'Missing session public key'
						}
					},
					lang
				),
				{ status: 400 }
			);
		}

		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);

		const respond = async (payload: any, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(
				sessionPublicKey,
				JSON.stringify(localizePayload(payload, lang))
			);
			return json(enc, { status });
		};

		// 3. Rate limit — khóa theo IP client, respond mã hoá để client xử lý hiển thị đúng
		const rateLimit = checkRateLimit(`register-check:${getClientAddress()}`);
		if (!rateLimit.allowed) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Quá nhiều yêu cầu kiểm tra — vui lòng thử lại sau vài giây',
						en: 'Too many check requests — please try again in a few seconds'
					}
				},
				429
			);
		}

		const result: {
			ok: boolean;
			username?: {
				checked: boolean;
				valid: boolean;
				taken: boolean;
				available: boolean;
				message: TranslateContent;
			};
			email?: {
				checked: boolean;
				valid: boolean;
				taken: boolean;
				available: boolean;
				message: TranslateContent;
			};
			phone?: {
				checked: boolean;
				valid: boolean;
				taken: boolean;
				available: boolean;
				message: TranslateContent;
			};
		} = { ok: true };

		// 4. Check Username
		if (typeof username === 'string') {
			const normalizedUsername = username.trim().toLowerCase();
			if (!normalizedUsername) {
				result.username = {
					checked: true,
					valid: false,
					taken: false,
					available: false,
					message: {
						vi: 'Vui lòng nhập tên đăng nhập',
						en: 'Please enter a username'
					}
				};
			} else if (!USERNAME_REGEX.test(normalizedUsername)) {
				result.username = {
					checked: true,
					valid: false,
					taken: false,
					available: false,
					message: {
						vi: 'Tên đăng nhập từ 3-30 ký tự (chữ cái, số, gạch dưới, gạch ngang)',
						en: 'Username must be 3-30 characters (letters, numbers, underscores, dashes)'
					}
				};
			} else {
				const usernameBlindIndex = await encryption.hmacBlindIndex(
					systemVault.indexKey,
					normalizedUsername
				);
				const taken = await Users.isUsernameTaken(usernameBlindIndex);
				result.username = {
					checked: true,
					valid: true,
					taken,
					available: !taken,
					message: taken
						? {
								vi: 'Tên đăng nhập này đã được sử dụng',
								en: 'Username is already taken'
							}
						: {
								vi: 'Tên đăng nhập khả dụng',
								en: 'Username is available'
							}
				};
			}
		}

		// 5. Check Email
		if (typeof email === 'string') {
			const normalizedEmail = email.trim().toLowerCase();
			if (!normalizedEmail) {
				result.email = {
					checked: true,
					valid: false,
					taken: false,
					available: false,
					message: {
						vi: 'Vui lòng nhập địa chỉ email',
						en: 'Please enter an email'
					}
				};
			} else if (!EMAIL_REGEX.test(normalizedEmail)) {
				result.email = {
					checked: true,
					valid: false,
					taken: false,
					available: false,
					message: {
						vi: 'Định dạng email không hợp lệ',
						en: 'Invalid email format'
					}
				};
			} else {
				const emailBlindIndex = await encryption.hmacBlindIndex(
					systemVault.indexKey,
					normalizedEmail
				);
				const taken = await Users.isEmailTaken(emailBlindIndex);
				result.email = {
					checked: true,
					valid: true,
					taken,
					available: !taken,
					message: taken
						? {
								vi: 'Email này đã được đăng ký',
								en: 'Email is already registered'
							}
						: {
								vi: 'Email khả dụng',
								en: 'Email is available'
							}
				};
			}
		}

		// 6. Check Phone
		if (typeof phone === 'string') {
			const normalizedPhone = phone.trim();
			if (!normalizedPhone) {
				result.phone = {
					checked: true,
					valid: false,
					taken: false,
					available: false,
					message: {
						vi: 'Vui lòng nhập số điện thoại',
						en: 'Please enter a phone number'
					}
				};
			} else if (!PHONE_REGEX.test(normalizedPhone)) {
				result.phone = {
					checked: true,
					valid: false,
					taken: false,
					available: false,
					message: {
						vi: 'Số điện thoại không hợp lệ',
						en: 'Invalid phone number'
					}
				};
			} else {
				const phoneBlindIndex = await encryption.hmacBlindIndex(
					systemVault.indexKey,
					normalizedPhone
				);
				const taken = await Users.isPhoneTaken(phoneBlindIndex);
				result.phone = {
					checked: true,
					valid: true,
					taken,
					available: !taken,
					message: taken
						? {
								vi: 'Số điện thoại này đã được sử dụng',
								en: 'Phone number is already taken'
							}
						: {
								vi: 'Số điện thoại khả dụng',
								en: 'Phone number is available'
							}
				};
			}
		}

		return respond(result);
	} catch (error) {
		console.error('Error in /api/register/check:', error);
		return json(
			localizePayload(
				{
					ok: false,
					message: {
						vi: 'Đã xảy ra lỗi khi kiểm tra dữ liệu',
						en: 'An error occurred while checking data'
					}
				},
				lang
			),
			{ status: 500 }
		);
	}
};
