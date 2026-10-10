// $store/system-vault.ts
import { cbVault } from '$modules/couchbase/clients';
import { encryption } from '$modules/encryption';
import { vault_password, cb_collectionName_vault } from '$env/static/private';
import { pushPublicKeyToPartyKit } from '$lib/server/partykit-push';

export let systemVault: {
	/** Khoá RSA-OAEP — mã hoá/decrypt hybrid encrypted API (KHÔNG dùng ký JWT) */
	privateKey: CryptoKey;
	publicKey: CryptoKey;
	/** Kặp khoá ECDSA P-256 (ES256) — ký/verify JWT access token riêng biệt */
	jwtPrivateKey: CryptoKey;
	jwtPublicKey: CryptoKey;
	indexKey: Uint8Array;
};

import type { CollectionName } from '$modules/schema';

// env variable cb_collectionName_vault là string — cast sang CollectionName để match cbVault signature
const cbSystemSecrets = cbVault(cb_collectionName_vault as CollectionName);

async function getKeyPairFromStored(stored: {
	publicKeyB64: string;
	privateKeyEncrypted: { ivB64: string; ciphertextB64: string };
	saltB64: string;
	dekIvB64: string;
	wrappedDekB64: string;
}) {
	const dek = await encryption.unlockVault(vault_password, {
		saltB64: stored.saltB64,
		dekIvB64: stored.dekIvB64,
		wrappedDekB64: stored.wrappedDekB64
	});
	const privateKeyB64 = await encryption.decryptData(dek, stored.privateKeyEncrypted);
	return {
		publicKey: await encryption.importPublicKey(stored.publicKeyB64),
		privateKey: await encryption.importPrivateKey(privateKeyB64)
	};
}

/**
 * Nạp cặp khoá ECDSA P-256 (ES256) từ doc vault, hoặc sinh + lưu MỚI nếu chưa có.
 * Tách hẳn khỏi khoá RSA (encrypted API) — JWT cần thuật toán riêng, dùng chung
 * sẽ chết "Key algorithm mismatch". Private key được encrypt bằng DEK như khoá RSA
 * → cùng cơ chế bảo vệ vault_password.
 */
async function loadOrCreateJwtKeyPair(dek: CryptoKey): Promise<{
	jwtPrivateKey: CryptoKey;
	jwtPublicKey: CryptoKey;
}> {
	const doc = await cbSystemSecrets.document.get({ documentKey: 'jwt-keypair' });
	const stored = doc.ok && doc.data
		? (doc.data as {
				publicKeyB64: string;
				privateKeyEncrypted: { ivB64: string; ciphertextB64: string };
		  })
		: undefined;

	if (stored) {
		const privateKeyB64 = await encryption.decryptData(dek, stored.privateKeyEncrypted);
		return {
			jwtPublicKey: await importEcdsaPublicKey(stored.publicKeyB64),
			jwtPrivateKey: await importEcdsaPrivateKey(privateKeyB64)
		};
	}

	// Chưa có — sinh cặp mới (extractable để export spki/pkcs8 lưu vào vault)
	const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
		'sign',
		'verify'
	]);
	const publicKeyB64 = await encryption.exportKeyToBase64(pair.publicKey, 'spki');
	const privateKeyB64 = await encryption.exportKeyToBase64(pair.privateKey, 'pkcs8');
	const privateKeyEncrypted = await encryption.encryptData(dek, privateKeyB64);

	await cbSystemSecrets.document.create({
		documentKey: 'jwt-keypair',
		content: {
			type: 'jwt_keypair',
			publicKeyB64,
			privateKeyEncrypted,
			version: 1,
			createdAt: new Date().toISOString()
		}
	});

	return { jwtPrivateKey: pair.privateKey, jwtPublicKey: pair.publicKey };
}

/** Import public key ECDSA từ base64 (spki) — usage verify, mirror importPublicKey RSA. */
async function importEcdsaPublicKey(base64: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'spki',
		encryption.base64ToBytes(base64),
		{ name: 'ECDSA', namedCurve: 'P-256' },
		true,
		['verify']
	);
}

/** Import private key ECDSA từ base64 (pkcs8) — usage sign, mirror importPrivateKey RSA. */
async function importEcdsaPrivateKey(base64: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'pkcs8',
		encryption.base64ToBytes(base64),
		{ name: 'ECDSA', namedCurve: 'P-256' },
		true,
		['sign']
	);
}

export async function initSystemVault() {
	// ---------- RSA keypair ----------
	let publicKey, privateKey, indexKey;
	let dek: CryptoKey | undefined; // DEK dùng chung: unlock RSA cũ hoặc setup vault mới
	const rsaDoc = await cbSystemSecrets.document.get({ documentKey: 'rsa-keypair' });
	const indexDoc = await cbSystemSecrets.document.get({ documentKey: 'index-key' });
	if (rsaDoc.ok && rsaDoc.data && indexDoc.ok && indexDoc.data) {
		const storedRsa = rsaDoc.data as {
			publicKeyB64: string;
			privateKeyEncrypted: { ivB64: string; ciphertextB64: string };
			saltB64: string;
			dekIvB64: string;
			wrappedDekB64: string;
		};

		({ privateKey, publicKey } = await getKeyPairFromStored(storedRsa));
		const storedIndex = indexDoc.data as {
			saltB64: string;
			dekIvB64: string;
			wrappedDekB64: string;
		};
		indexKey = await encryption.unlockIndexKey(vault_password, storedIndex);
		dek = await encryption.unlockVault(vault_password, {
			saltB64: storedRsa.saltB64,
			dekIvB64: storedRsa.dekIvB64,
			wrappedDekB64: storedRsa.wrappedDekB64
		});
	} else {
		// Lần đầu — sinh RSA keypair mới, bảo vệ bằng vault_password
		if (!rsaDoc.ok && !rsaDoc.data) {
			const { dek: newDek, storageRecord } = await encryption.setupVault(vault_password);
			dek = newDek;
			({ publicKey, privateKey } = await encryption.generateRSAKeyPair());

			const publicKeyB64 = await encryption.exportKeyToBase64(publicKey, 'spki');
			const privateKeyB64 = await encryption.exportKeyToBase64(privateKey, 'pkcs8');
			const privateKeyEncrypted = await encryption.encryptData(dek, privateKeyB64);

			await cbSystemSecrets.document.create({
				documentKey: 'rsa-keypair',
				content: {
					type: 'rsa_keypair',
					publicKeyB64,
					privateKeyEncrypted,
					...storageRecord,
					version: 1,
					createdAt: new Date().toISOString()
				}
			});
		} else {
			const storedRsa = rsaDoc.data as {
				publicKeyB64: string;
				privateKeyEncrypted: { ivB64: string; ciphertextB64: string };
				saltB64: string;
				dekIvB64: string;
				wrappedDekB64: string;
			};
			({ privateKey, publicKey } = await getKeyPairFromStored(storedRsa));
			dek = await encryption.unlockVault(vault_password, {
				saltB64: storedRsa.saltB64,
				dekIvB64: storedRsa.dekIvB64,
				wrappedDekB64: storedRsa.wrappedDekB64
			});
		}
		if (!indexDoc.ok || !indexDoc.data) {
			const { indexKeyRaw, storageRecord } = await encryption.setupIndexKey(vault_password);

			await cbSystemSecrets.document.create({
				documentKey: 'index-key',
				content: {
					type: 'index_key',
					...storageRecord,
					version: 1,
					createdAt: new Date().toISOString()
				}
			});

			indexKey = indexKeyRaw;
		} else {
			const storedIndex = indexDoc.data as {
				saltB64: string;
				dekIvB64: string;
				wrappedDekB64: string;
			};
			indexKey = await encryption.unlockIndexKey(vault_password, storedIndex);
		}
	}
	// ---------- JWT keypair (ECDSA P-256 — ES256) ----------
	// Sinh lần đầu + lưu vault, sau đó tái dùng qua restart (token không bị
	// invalid sau restart — yêu cầu comment gốc trong jwt.ts).
	if (!dek) throw new Error('[initSystemVault] DEK unavailable — cannot provision JWT keypair');
	const { jwtPrivateKey, jwtPublicKey } = await loadOrCreateJwtKeyPair(dek);

	systemVault = { publicKey, privateKey, jwtPrivateKey, jwtPublicKey, indexKey };

	// Push public key sang PartyKit (fire-and-forget, có retry + không bao giờ throw)
	// để client lấy key qua WS thay vì HTTP mỗi lần fetchSecure.
	encryption
		.exportKeyToBase64(publicKey, 'spki')
		.then((publicKeyB64) => pushPublicKeyToPartyKit(publicKeyB64))
		.catch((e) => console.error('[initSystemVault] push public key to PartyKit failed:', e));
}
