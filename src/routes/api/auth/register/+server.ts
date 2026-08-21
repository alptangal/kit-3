import { encryption } from '$modules/encryption';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cbData } from '$modules/couchbase/clients';
import type { ServerResponse } from '$interfaces/basic';
import { systemVault } from '$store/initSystemVault';
import type { RegisterRequestBody } from '../../../(unauthorized)/register/_interface';

const cbUsers = cbData('users');

const MIN_PASSWORD_LENGTH = 8;

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

		const dataDecrypted: RegisterRequestBody = JSON.parse(decryptedText);
		const { publicKeyB64 } = dataDecrypted;

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
		const { email, firstName, lastName, midName, password, username } = dataDecrypted;

		if (!email || !username || !password) {
			return respond({ message: 'Missing field required' }, 400);
		}
		if (!EMAIL_REGEX.test(email)) {
			return respond({ message: 'Invalid email format' }, 400);
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			return respond(
				{ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
				400
			);
		}

		const normalizedEmail = email.trim().toLowerCase();
		const emailBlindIndex = await encryption.hmacBlindIndex(systemVault.indexKey, normalizedEmail);
		const existing = await cbUsers.query.document.search({
			collectionName: 'users',
			conditions: [{ fieldName: 'emailBlindIndex', keyword: emailBlindIndex, operator: 'EQUALS' }],
			selectFields: ['name']
		});
		if (existing.ok && existing.data && existing.data.length > 0) {
			return respond({ message: 'Email already registered' }, 409);
		}
		const { dek, storageRecord } = await encryption.setupVault(password);
		const emailEncrypted = await encryption.encryptData(dek, normalizedEmail);

		const userDoc = {
			firstName,
			lastName,
			midName,
			description: '',
			status: 'not active',
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
	} catch (e) {
		return json({ message: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
