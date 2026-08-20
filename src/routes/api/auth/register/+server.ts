// routes/api/auth/register/+server.ts
import { encryption } from '$modules/encryption';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cbData } from '$modules/couchbase/clients';
import { randomBytes, randomUUID } from 'crypto';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { webauthn_rp_id, webauthn_rp_name, webauthn_origin } from '$env/static/private';
import type { AuthMethod, ServerResponse } from '$interfaces/basic';
import { systemVault } from '$store/initSystemVault';

const cbUsers = cbData('users');
const cbChallenges = cbData('webauthn_challenges');

const MIN_PASSWORD_LENGTH = 8;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: RequestHandler = async ({ request }) => {
	try {
		if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
			throw new Error('System crash');
		}
		const jsRaw = await request.json();
		const decryptedText = await encryption.decryptWithPrivateKeyHybrid(
			systemVault.privateKey,
			jsRaw
		);
		if (!decryptedText) {
			return json({ message: 'Decryption returned empty' }, { status: 400 });
		}

		const dataDecrypted: Record<string, any> = JSON.parse(decryptedText);
		const { publicKeyB64, action } = dataDecrypted;

		if (!publicKeyB64) {
			return json({ message: 'Missing session public key' }, { status: 400 });
		}
		const sessionPublicKey = await encryption.importPublicKey(publicKeyB64);

		const respond = async (payload: ServerResponse, status = 200) => {
			const enc = await encryption.encryptWithPublicKeyHybrid(
				sessionPublicKey,
				JSON.stringify(payload)
			);
			return json(enc, { status });
		};
		console.log(action);
		// ============ BƯỚC 1: REGISTER-INIT ============
		if (action === 'register-init') {
			const { email, firstname, lastname, midname, password, authMethod } = dataDecrypted as {
				email?: string;
				firstname?: string;
				lastname?: string;
				midname?: string;
				password?: string;
				authMethod?: AuthMethod;
			};
			const name = `${firstname} ${midname} ${lastname}`;

			if (!email || !name || !password) {
				return respond({ message: 'Missing email, name or password' }, 400);
			}
			if (!EMAIL_REGEX.test(email)) {
				return respond({ message: 'Invalid email format' }, 400);
			}
			if (name.trim().length === 0 || name.length > 200) {
				return respond({ message: 'Invalid name' }, 400);
			}
			if (password.length < MIN_PASSWORD_LENGTH) {
				return respond(
					{ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
					400
				);
			}
			if (authMethod !== 'webauthn' && authMethod !== 'password') {
				return respond({ message: 'Invalid or missing authMethod' }, 400);
			}

			const normalizedEmail = email.trim().toLowerCase();
			const emailBlindIndex = await encryption.hmacBlindIndex(
				systemVault.indexKey,
				normalizedEmail
			);

			// Kiểm tra email đã tồn tại chưa (áp dụng cho cả 2 nhánh)
			// Lưu ý: đây không phải khoá duy nhất tuyệt đối ở tầng DB (race condition
			// vẫn có thể xảy ra nếu 2 request đồng thời cùng email chưa từng tồn tại).
			// Nếu cần chặt hơn, nên tạo GSI UNIQUE hoặc dùng emailBlindIndex làm documentKey.
			const existing = await cbUsers.query.document.search({
				collectionName: 'users',
				conditions: [
					{ fieldName: 'emailBlindIndex', keyword: emailBlindIndex, operator: 'EQUALS' }
				],
				selectFields: ['name']
			});
			if (existing.ok && existing.data && existing.data.length > 0) {
				return respond({ message: 'Email already registered' }, 409);
			}

			// Setup vault: sinh DEK, wrap bằng KEK derive từ password.
			// Áp dụng cho CẢ 2 nhánh — vault không phụ thuộc phương thức xác thực,
			// nó chỉ là lớp mã hoá dữ liệu, còn WebAuthn/password là lớp XÁC THỰC.
			const { dek, storageRecord } = await encryption.setupVault(password);
			const emailEncrypted = await encryption.encryptData(dek, normalizedEmail);
			// Sau dòng này password/dek không còn được dùng nữa, tự động bị GC
			console.log(action);
			// ---------- Nhánh A: password-only (thiết bị không hỗ trợ WebAuthn) ----------
			if (authMethod === 'password') {
				const userDoc = {
					name: name.trim(),
					description: '',
					status: 'active',
					role: 'user',

					emailBlindIndex,
					emailEncrypted,

					vaultSaltB64: storageRecord.saltB64,
					vaultDekIvB64: storageRecord.dekIvB64,
					vaultWrappedDekB64: storageRecord.wrappedDekB64,

					authMethod: 'password' as const,
					webauthnCredentials: [],
					webauthnUserHandle: null,

					mfaEnabled: false,
					lastLoginAt: null,
					lastLoginIp: null,

					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					deletedAt: null
				};

				const createUserRes = await cbUsers.document.create({ content: userDoc });
				if (!createUserRes.ok) {
					return respond({ message: 'Failed to create user' }, 500);
				}

				return respond({ message: 'Registration successful', data: { authMethod: 'password' } });
			}

			// ---------- Nhánh B: webauthn (cần round-trip challenge) ----------
			const userHandle = randomBytes(32).toString('base64url');

			const webauthnOptions = await generateRegistrationOptions({
				rpName: webauthn_rp_name,
				rpID: webauthn_rp_id,
				userID: Buffer.from(userHandle),
				userName: normalizedEmail,
				attestationType: 'none',
				authenticatorSelection: {
					residentKey: 'preferred',
					userVerification: 'preferred'
				}
			});

			const registrationId = randomUUID();

			const createRes = await cbChallenges.document.create({
				documentKey: registrationId,
				content: {
					challenge: webauthnOptions.challenge,
					emailBlindIndex,
					emailEncrypted,
					vaultSaltB64: storageRecord.saltB64,
					vaultDekIvB64: storageRecord.dekIvB64,
					vaultWrappedDekB64: storageRecord.wrappedDekB64,
					nameTemp: name.trim(),
					userHandle,
					createdAt: new Date().toISOString()
				}
			});
			if (!createRes.ok) {
				return respond({ message: 'Failed to store registration challenge' }, 500);
			}
			return respond({ data: { registrationId, webauthnOptions, authMethod: 'webauthn' } });
		}

		// ============ BƯỚC 2: REGISTER-VERIFY (chỉ áp dụng cho nhánh webauthn) ============
		if (action === 'register-verify') {
			const { registrationId, webauthnResponse } = dataDecrypted as {
				registrationId?: string;
				webauthnResponse?: any;
			};

			if (!registrationId || !webauthnResponse) {
				return respond({ message: 'Missing registrationId or webauthnResponse' }, 400);
			}

			const challengeDoc = await cbChallenges.document.get({ documentKey: registrationId });
			if (!challengeDoc.ok || !challengeDoc.data) {
				return respond({ message: 'Registration session not found or expired' }, 400);
			}

			const stored = challengeDoc.data as {
				challenge: string;
				emailBlindIndex: string;
				emailEncrypted: { ivB64: string; ciphertextB64: string };
				vaultSaltB64: string;
				vaultDekIvB64: string;
				vaultWrappedDekB64: string;
				nameTemp: string;
				userHandle: string;
				createdAt: string;
			};

			const ageMs = Date.now() - new Date(stored.createdAt).getTime();
			if (ageMs > CHALLENGE_TTL_MS) {
				await cbChallenges.document.delete({ documentKey: registrationId });
				return respond({ message: 'Registration session expired' }, 400);
			}

			// Double-check email chưa bị đăng ký bởi request khác trong lúc chờ verify
			// (chống race condition: 2 lượt register-init cùng email gần như đồng thời)
			const stillAvailable = await cbUsers.query.document.search({
				collectionName: 'users',
				conditions: [
					{ fieldName: 'emailBlindIndex', keyword: stored.emailBlindIndex, operator: 'EQUALS' }
				],
				selectFields: ['name']
			});
			if (stillAvailable.ok && stillAvailable.data && stillAvailable.data.length > 0) {
				await cbChallenges.document.delete({ documentKey: registrationId });
				return respond({ message: 'Email already registered' }, 409);
			}

			const verification = await verifyRegistrationResponse({
				response: webauthnResponse,
				expectedChallenge: stored.challenge,
				expectedOrigin: webauthn_origin,
				expectedRPID: webauthn_rp_id
			});

			if (!verification.verified || !verification.registrationInfo) {
				return respond({ message: 'WebAuthn verification failed' }, 400);
			}

			const { credential } = verification.registrationInfo;

			const userDoc = {
				name: stored.nameTemp,
				description: '',
				status: 'active',
				role: 'user',

				emailBlindIndex: stored.emailBlindIndex,
				emailEncrypted: stored.emailEncrypted,

				vaultSaltB64: stored.vaultSaltB64,
				vaultDekIvB64: stored.vaultDekIvB64,
				vaultWrappedDekB64: stored.vaultWrappedDekB64,

				authMethod: 'webauthn' as const,
				webauthnCredentials: [
					{
						credentialId: credential.id,
						publicKey: Buffer.from(credential.publicKey).toString('base64'),
						counter: credential.counter,
						transports: credential.transports ?? []
					}
				],
				webauthnUserHandle: stored.userHandle,

				mfaEnabled: false,
				lastLoginAt: null,
				lastLoginIp: null,

				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				deletedAt: null
			};

			const createUserRes = await cbUsers.document.create({ content: userDoc });
			if (!createUserRes.ok) {
				return respond({ message: 'Failed to create user' }, 500);
			}

			await cbChallenges.document.delete({ documentKey: registrationId });

			return respond({ message: 'Registration successful', data: { authMethod: 'webauthn' } });
		}

		return respond({ message: 'Unknown action' }, 400);
	} catch (e) {
		return json({ message: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
