import { encryption } from '$modules/encryption';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cbData } from '$modules/couchbase/clients';
import type { ServerResponse, TranslateContent } from '$interfaces/basic';
import { systemVault } from '$store/initSystemVault';
import type { RegisterRequestBody } from '../../(unauthorized)/register/_interface';
import { Users } from '$lib/server/db/users';
import type { User } from '$modules/schema';

const collectionName = 'users';
const cbUsers = cbData(collectionName);
const cbRoles = cbData('name_roles');
const cbUserStatus = cbData('user_status');

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;

const registerMessages = {
	systemUnavailable: {
		vi: 'Hệ thống đang khởi tạo kho mã hoá — vui lòng thử lại sau',
		en: 'Service unavailable — system initializing'
	} as TranslateContent,
	missingSessionKey: {
		vi: 'Thiếu khoá phiên client (public key)',
		en: 'Missing session public key'
	} as TranslateContent,
	missingFields: {
		vi: 'Vui lòng điền đầy đủ các thông tin bắt buộc',
		en: 'Please fill in all required fields'
	} as TranslateContent,
	invalidEmail: {
		vi: 'Định dạng email không hợp lệ',
		en: 'Invalid email format'
	} as TranslateContent,
	invalidUsername: {
		vi: 'Tên đăng nhập từ 3-30 ký tự (chữ cái, số, gạch dưới, gạch ngang)',
		en: 'Username must be 3-30 characters (letters, numbers, underscores, dashes)'
	} as TranslateContent,
	passwordLength: {
		vi: `Mật khẩu phải chứa ít nhất ${MIN_PASSWORD_LENGTH} ký tự`,
		en: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
	} as TranslateContent,
	emailTaken: {
		vi: 'Email này đã được đăng ký',
		en: 'Email is already registered'
	} as TranslateContent,
	usernameTaken: {
		vi: 'Tên đăng nhập này đã được sử dụng',
		en: 'Username is already taken'
	} as TranslateContent,
	createFailed: {
		vi: 'Tạo tài khoản thất bại, vui lòng thử lại sau',
		en: 'Failed to create user account'
	} as TranslateContent,
	success: {
		vi: 'Đăng ký tài khoản thành công',
		en: 'Registration successful'
	} as TranslateContent
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		// 1. Kiểm tra systemVault đã sẵn sàng
		if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
			return json(
				{ message: registerMessages.systemUnavailable, ok: false },
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
		const dataDecrypted: RegisterRequestBody = JSON.parse(decryptedText);
		const { publicKeyB64 } = dataDecrypted;

		if (!publicKeyB64) {
			return json({ message: registerMessages.missingSessionKey, ok: false }, { status: 400 });
		}
		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);

		const respond = async (payload: ServerResponse, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(
				sessionPublicKey,
				JSON.stringify(payload)
			);
			return json(enc, { status });
		};

		const { email, firstname, lastname, midname, password, username, phone } = dataDecrypted;

		// 4. Validate dữ liệu đầu vào
		if (!email || !username || !password || !firstname || !lastname) {
			return respond({ message: registerMessages.missingFields, ok: false }, 400);
		}

		const normalizedEmail = email.trim().toLowerCase();
		const normalizedUsername = username.trim().toLowerCase();
		const normalizedPhone = (phone ?? '').trim();

		if (!EMAIL_REGEX.test(normalizedEmail)) {
			return respond({ message: registerMessages.invalidEmail, ok: false }, 400);
		}
		if (!USERNAME_REGEX.test(normalizedUsername)) {
			return respond({ message: registerMessages.invalidUsername, ok: false }, 400);
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			return respond({ message: registerMessages.passwordLength, ok: false }, 400);
		}

		// 5. Tính toán Blind Index song song
		const [emailBlindIndex, usernameBlindIndex, phoneBlindIndex] = await Promise.all([
			encryption.hmacBlindIndex(systemVault.indexKey, normalizedEmail),
			encryption.hmacBlindIndex(systemVault.indexKey, normalizedUsername),
			encryption.hmacBlindIndex(systemVault.indexKey, normalizedPhone)
		]);

		// 6. Kiểm tra trùng lặp email và username đồng thời
		const [emailTaken, usernameTaken] = await Promise.all([
			Users.isEmailTaken(emailBlindIndex),
			Users.isUsernameTaken(usernameBlindIndex)
		]);

		if (emailTaken) {
			return respond({ message: registerMessages.emailTaken, ok: false }, 409);
		}
		if (usernameTaken) {
			return respond({ message: registerMessages.usernameTaken, ok: false }, 409);
		}

		// 7. Thiết lập mã hoá user vault DEK và mã hoá dữ liệu nhạy cảm
		const { dek, storageRecord } = await encryption.setupVault(password);
		const [emailEncrypted, phoneEncrypted, profileEncrypted] = await Promise.all([
			encryption.encryptData(dek, normalizedEmail).then((r) => JSON.stringify(r)),
			encryption.encryptData(dek, normalizedPhone).then((r) => JSON.stringify(r)),
			encryption.encryptData(dek, JSON.stringify({})).then((r) => JSON.stringify(r))
		]);

		// 8. Đảm bảo role và status hợp lệ (mặc định role-customer và status-active)
		const roleId = 'role-customer';
		const statusId = 'status-active';

		const now = new Date().toISOString();
		const newKey = `${collectionName}::${crypto.randomUUID()}`;

		// 9. Khởi tạo Document User hoàn chỉnh chuẩn schema.ts
		const userDoc: User = {
			firstname: firstname.trim(),
			midname: midname ? midname.trim() : null,
			lastname: lastname.trim(),
			description: '',
			roleId,
			statusId,

			emailBlindIndex,
			emailEncrypted,
			phoneBlindIndex,
			phoneEncrypted,
			usernameBlindIndex,
			profileEncrypted,

			vaultSaltB64: storageRecord.saltB64,
			vaultDekIvB64: storageRecord.dekIvB64,
			vaultWrappedDekB64: storageRecord.wrappedDekB64,

			authMethod: 'password',
			webauthnCredentials: [],
			webauthnUserHandle: crypto.randomUUID(),

			mfaEnabled: false,
			lastLoginAt: null,
			lastLoginIp: null,
			remember: false,

			branchId: null,

			createdAt: now,
			updatedAt: now,
			deletedAt: null
		};

		const createUserRes = await cbUsers.document.create({
			documentKey: newKey,
			content: userDoc
		});

		if (!createUserRes.ok) {
			return respond({ message: registerMessages.createFailed, ok: false }, 500);
		}

		return respond(
			{
				ok: true,
				message: registerMessages.success,
				data: { authMethod: 'password' }
			},
			200
		);
	} catch (e) {
		console.error('[POST /api/register]', e);
		return json(
			{ message: e instanceof Error ? e.message : String(e), ok: false },
			{ status: 500 }
		);
	}
};

