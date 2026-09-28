import { d as cbVault, v as vault_password, f as cb_collectionName_vault } from "./clients.js";
import { e as encryption } from "./encryption.js";
let systemVault;
const cbSystemSecrets = cbVault(cb_collectionName_vault);
async function getKeyPairFromStored(stored) {
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
async function initSystemVault() {
  let publicKey, privateKey, indexKey;
  const rsaDoc = await cbSystemSecrets.document.get({ documentKey: "rsa-keypair" });
  const indexDoc = await cbSystemSecrets.document.get({ documentKey: "index-key" });
  if (rsaDoc.ok && rsaDoc.data && indexDoc.ok && indexDoc.data) {
    const storedRsa = rsaDoc.data;
    ({ privateKey, publicKey } = await getKeyPairFromStored(storedRsa));
    const storedIndex = indexDoc.data;
    indexKey = await encryption.unlockIndexKey(vault_password, storedIndex);
  } else {
    if (!rsaDoc.ok && !rsaDoc.data) {
      const { dek, storageRecord } = await encryption.setupVault(vault_password);
      ({ publicKey, privateKey } = await encryption.generateRSAKeyPair());
      const publicKeyB64 = await encryption.exportKeyToBase64(publicKey, "spki");
      const privateKeyB64 = await encryption.exportKeyToBase64(privateKey, "pkcs8");
      const privateKeyEncrypted = await encryption.encryptData(dek, privateKeyB64);
      await cbSystemSecrets.document.create({
        documentKey: "rsa-keypair",
        content: {
          type: "rsa_keypair",
          publicKeyB64,
          privateKeyEncrypted,
          ...storageRecord,
          version: 1,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    } else {
      const storedRsa = rsaDoc.data;
      ({ privateKey, publicKey } = await getKeyPairFromStored(storedRsa));
    }
    if (!indexDoc.ok || !indexDoc.data) {
      const { indexKeyRaw, storageRecord } = await encryption.setupIndexKey(vault_password);
      await cbSystemSecrets.document.create({
        documentKey: "index-key",
        content: {
          type: "index_key",
          ...storageRecord,
          version: 1,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      indexKey = indexKeyRaw;
    } else {
      const storedIndex = indexDoc.data;
      indexKey = await encryption.unlockIndexKey(vault_password, storedIndex);
    }
  }
  systemVault = { publicKey, privateKey, indexKey };
}
export {
  initSystemVault as i,
  systemVault as s
};
