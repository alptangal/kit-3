// $store/system-vault.ts
import { cbVault } from '$modules/couchbase/clients';
import { encryption } from '$modules/encryption';
import { vault_password, cb_collectionName_vault } from '$env/static/private';

export let systemVault: {
	privateKey: CryptoKey;
	publicKey: CryptoKey;
	indexKey: Uint8Array;
};

const cbSystemSecrets = cbVault(cb_collectionName_vault);

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

export async function initSystemVault() {
	// ---------- RSA keypair ----------
	let publicKey, privateKey, indexKey;
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
	} else {
		// Lần đầu — sinh RSA keypair mới, bảo vệ bằng vault_password
		if (!rsaDoc.ok && !rsaDoc.data) {
			const { dek, storageRecord } = await encryption.setupVault(vault_password);
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
	systemVault = { publicKey, privateKey, indexKey };
}
