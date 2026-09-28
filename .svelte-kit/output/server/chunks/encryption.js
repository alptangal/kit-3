function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function base64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
const PBKDF2_ITERATIONS = 6e5;
async function deriveKEK(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      // ArrayBuffer
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    // KEK không cần extractable — không bao giờ export ra ngoài
    ["encrypt", "decrypt"]
  );
}
async function setupVault(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKEK(password, salt);
  const dek = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    // phải extractable để wrap được
    ["encrypt", "decrypt"]
  );
  const dekIv = crypto.getRandomValues(new Uint8Array(12));
  const rawDek = await crypto.subtle.exportKey("raw", dek);
  const wrappedDek = await crypto.subtle.encrypt({ name: "AES-GCM", iv: dekIv }, kek, rawDek);
  return {
    dek,
    storageRecord: {
      saltB64: bufToBase64(salt),
      dekIvB64: bufToBase64(dekIv),
      wrappedDekB64: bufToBase64(wrappedDek)
    }
  };
}
async function unlockVault(password, storageRecord) {
  const salt = base64ToBuf(storageRecord.saltB64);
  const dekIv = base64ToBuf(storageRecord.dekIvB64);
  const wrappedDek = base64ToBuf(storageRecord.wrappedDekB64);
  const kek = await deriveKEK(password, salt);
  let rawDek;
  try {
    rawDek = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dekIv }, kek, wrappedDek);
  } catch (err) {
    throw new Error("Sai mật khẩu hoặc dữ liệu bị hỏng");
  }
  return crypto.subtle.importKey(
    "raw",
    rawDek,
    { name: "AES-GCM" },
    // extractable: true — cần thiết để changePassword() có thể export rồi re-wrap DEK.
    // Nếu app của bạn KHÔNG cần đổi password, đổi thành false để an toàn hơn
    // (ngăn code khác vô tình export raw key ra ngoài).
    true,
    ["encrypt", "decrypt"]
  );
}
async function encryptData(dek, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    new TextEncoder().encode(plaintext)
  );
  return {
    ivB64: bufToBase64(iv),
    ciphertextB64: bufToBase64(ciphertext)
  };
}
async function decryptData(dek, record) {
  const iv = base64ToBuf(record.ivB64);
  const ciphertext = base64ToBuf(record.ciphertextB64);
  const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, dek, ciphertext);
  return new TextDecoder().decode(plaintextBuf);
}
async function changePassword(oldPassword, newPassword, oldStorageRecord) {
  const dek = await unlockVault(oldPassword, oldStorageRecord);
  const rawDek = await crypto.subtle.exportKey("raw", dek);
  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  const newKek = await deriveKEK(newPassword, newSalt);
  const newDekIv = crypto.getRandomValues(new Uint8Array(12));
  const newWrappedDek = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: newDekIv },
    newKek,
    rawDek
  );
  return {
    saltB64: bufToBase64(newSalt),
    dekIvB64: bufToBase64(newDekIv),
    wrappedDekB64: bufToBase64(newWrappedDek)
  };
}
async function getServerPublicKeyB64() {
  try {
    const res = await fetch("/api/encryption/public-key");
    if (res.ok) {
      const js = await res.json();
      return js["data"]["publicKeyB64"];
    }
    return;
  } catch (e) {
    throw new Error("Something went wrong with api/public-key");
  }
}
async function getServerPublicKey() {
  const serverPublicKeyB64 = await getServerPublicKeyB64();
  if (serverPublicKeyB64) return await importPublicKey(serverPublicKeyB64);
  return;
}
async function generateRSAKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    // extractable — bắt buộc true nếu muốn export ra để lưu
    ["encrypt", "decrypt"]
  );
  return keyPair;
}
async function exportKeyToBase64(key, format) {
  const exported = await crypto.subtle.exportKey(format, key);
  let base64String;
  if (typeof Buffer !== "undefined") {
    base64String = Buffer.from(exported).toString("base64");
  } else {
    base64String = btoa(String.fromCharCode(...new Uint8Array(exported)));
  }
  return base64String;
}
function base64ToBytes(base64) {
  let binaryString;
  if (typeof Buffer !== "undefined") {
    binaryString = Buffer.from(base64, "base64").toString("binary");
  } else {
    binaryString = atob(base64);
  }
  const arrayBuffer = new ArrayBuffer(binaryString.length);
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
async function importPublicKey(base64) {
  const keyBytes = base64ToBytes(base64);
  return crypto.subtle.importKey(
    "spki",
    // format của public key
    keyBytes,
    { name: "RSA-OAEP", hash: "SHA-256" },
    // phải khớp thuật toán lúc generate
    true,
    // extractable
    ["encrypt"]
    // usage — public key dùng để encrypt
  );
}
async function importPrivateKey(base64) {
  const keyBytes = base64ToBytes(base64);
  return crypto.subtle.importKey(
    "pkcs8",
    // format của private key
    keyBytes,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
    // usage — private key dùng để decrypt
  );
}
async function encryptWithPublicKeyHybrid(publicKey, plaintext) {
  const sessionKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt"
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sessionKey,
    new TextEncoder().encode(plaintext)
  );
  const rawSessionKey = await crypto.subtle.exportKey("raw", sessionKey);
  const encryptedSessionKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawSessionKey
  );
  return {
    encryptedSessionKeyB64: bufToBase64(encryptedSessionKey),
    // AES key đã mã hoá bằng RSA
    ivB64: bufToBase64(iv),
    ciphertextB64: bufToBase64(ciphertext)
  };
}
async function decryptWithPrivateKeyHybrid(privateKey, record) {
  try {
    const encryptedSessionKey = base64ToBuf(record.encryptedSessionKeyB64);
    const rawSessionKey = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedSessionKey
    );
    const sessionKey = await crypto.subtle.importKey(
      "raw",
      rawSessionKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const iv = base64ToBuf(record.ivB64);
    const ciphertext = base64ToBuf(record.ciphertextB64);
    const plaintextBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      sessionKey,
      ciphertext
    );
    return new TextDecoder().decode(plaintextBuf);
  } catch (e) {
    console.log(e);
  }
}
const fetchSecure = async (url, options = {}, encryptKeys) => {
  const publicKey = await getServerPublicKey();
  if (!publicKey) return { ok: false, message: { vi: "Hệ thống chưa sẵn sàng!", en: "System crashed!" } };
  let sessionPublicKey;
  let sessionPublicKeyB64;
  let sessionPrivateKey;
  if (encryptKeys) {
    sessionPublicKey = encryptKeys.publicKey;
    sessionPublicKeyB64 = await exportKeyToBase64(sessionPublicKey, "spki");
    sessionPrivateKey = encryptKeys.privateKey;
  } else {
    const { privateKey, publicKey: newSessionPublicKey } = await generateRSAKeyPair();
    sessionPublicKey = newSessionPublicKey;
    sessionPrivateKey = privateKey;
    sessionPublicKeyB64 = await exportKeyToBase64(sessionPublicKey, "spki");
  }
  const payload = { ...options.body ?? {}, publicKeyB64: sessionPublicKeyB64 };
  const encryptedBody = await encryptWithPublicKeyHybrid(
    publicKey,
    JSON.stringify(payload)
  );
  let lang = "en";
  try {
    const { client } = await import("./basic.svelte.js").then((n) => n.f);
    lang = client.browser?.language ?? "en";
  } catch {
  }
  const res = await fetch(url, {
    method: options.method ?? "POST",
    headers: { "content-type": "application/json", "Accept-Language": lang },
    body: JSON.stringify(encryptedBody)
  });
  let decryptedPayload = null;
  try {
    const encryptedResponse = await res.json();
    const decryptedText = await decryptWithPrivateKeyHybrid(sessionPrivateKey, encryptedResponse);
    if (decryptedText) {
      decryptedPayload = JSON.parse(decryptedText);
    }
  } catch {
  }
  if (decryptedPayload) {
    return { ...decryptedPayload, ok: res.ok && (decryptedPayload.ok ?? true) };
  }
  if (!res.ok) {
    throw new Error(`fetchSecure: request failed with status ${res.status}`);
  }
  throw new Error("Encryption.decryptedText failed");
};
async function hmacBlindIndex(secretKey, value) {
  const keyBuffer = secretKey.buffer.slice(
    secretKey.byteOffset,
    secretKey.byteOffset + secretKey.byteLength
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value.trim().toLowerCase())
  );
  return bufToBase64(sig);
}
async function setupIndexKey(vaultPassword) {
  const { dek, storageRecord } = await setupVault(vaultPassword);
  const rawIndexKey = await crypto.subtle.exportKey("raw", dek);
  return {
    indexKeyRaw: new Uint8Array(rawIndexKey),
    storageRecord
    // { saltB64, dekIvB64, wrappedDekB64 } — lưu thẳng, đúng field name schema
  };
}
async function unlockIndexKey(vaultPassword, storageRecord) {
  const dek = await unlockVault(vaultPassword, storageRecord);
  const raw = await crypto.subtle.exportKey("raw", dek);
  return new Uint8Array(raw);
}
function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => {
    return `${JSON.stringify(key)}:${stableStringify(value[key])}`;
  }).join(",")}}`;
}
async function getDataHash(data) {
  const canonical = stableStringify(data);
  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
const encryption = {
  setupVault,
  unlockVault,
  encryptData,
  decryptData,
  changePassword,
  getServerPublicKeyB64,
  getServerPublicKey,
  generateRSAKeyPair,
  exportKeyToBase64,
  base64ToBytes,
  importPublicKey,
  importPrivateKey,
  encryptWithPublicKeyHybrid,
  decryptWithPrivateKeyHybrid,
  fetchSecure,
  hmacBlindIndex,
  setupIndexKey,
  unlockIndexKey,
  getDataHash
};
export {
  encryption as e
};
