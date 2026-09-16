// src/routes/api/register/check/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { Users } from '$lib/server/db/users';
import type { TranslateContent } from '$interfaces/basic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;

export const POST: RequestHandler = async ({ request }) => {
	try {
		// 1. Kiểm tra systemVault đã sẵn sàng
		if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
			return json(
				{
					ok: false,
					message: {
						vi: 'Hệ thống đang khởi tạo kho mã hoá — vui lòng thử lại sau',
						en: 'Service unavailable — system initializing'
					}
				},
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
		};

		const { publicKeyB64, username, email } = dataDecrypted;

		if (!publicKeyB64) {
			return json(
				{
					ok: false,
					message: {
						vi: 'Thiếu khoá phiên client (public key)',
						en: 'Missing session public key'
					}
				},
				{ status: 400 }
			);
		}

		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);

		const respond = async (payload: any, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(
				sessionPublicKey,
				JSON.stringify(payload)
			);
			return json(enc, { status });
		};

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
		} = { ok: true };

		// 3. Check Username
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

		// 4. Check Email
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

		return respond(result);
	} catch (error) {
		console.error('Error in /api/register/check:', error);
		return json(
			{
				ok: false,
				message: {
					vi: 'Đã xảy ra lỗi khi kiểm tra dữ liệu',
					en: 'An error occurred while checking data'
				}
			},
			{ status: 500 }
		);
	}
};
