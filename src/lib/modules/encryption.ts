//$modules/encryption.ts

/**
 * Envelope Encryption Module
 * Pattern: Password -> KEK (via PBKDF2) -> wraps DEK -> DEK encrypts data
 *
 * Storage format cho mỗi user (lưu trong DB):
 *   { saltB64, dekIvB64, wrappedDekB64 }
 *
 * Storage format cho mỗi data record (lưu trong DB):
 *   { ivB64, ciphertextB64 }
 */

import type { ServerResponse } from '$interfaces/basic';
// ============ Helpers: encode/decode để lưu DB (DB không lưu binary trực tiếp tốt) ============

function bufToBase64(buf: ArrayLike<number> | ArrayBuffer) {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

function base64ToBuf(b64: string) {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes.buffer;
}

// ============ Bước 1: Derive KEK từ password + salt (PBKDF2) ============

const PBKDF2_ITERATIONS = 600_000; // OWASP 2024 khuyến nghị cho PBKDF2-SHA256

async function deriveKEK(password: string, salt: BufferSource) {
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveKey']
	);

	return crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt, // ArrayBuffer
			iterations: PBKDF2_ITERATIONS,
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false, // KEK không cần extractable — không bao giờ export ra ngoài
		['encrypt', 'decrypt']
	);
}

// ============ Bước 2: Đăng ký lần đầu — sinh DEK, wrap bằng KEK ============

/**
 * Gọi 1 lần khi user tạo tài khoản / thiết lập mã hóa lần đầu.
 * @param {string} password
 * @returns {Promise<{
 *   dek: CryptoKey,          // dùng ngay để encrypt data trong session hiện tại
 *   storageRecord: {         // lưu vào DB, gắn với user
 *     saltB64: string,
 *     dekIvB64: string,
 *     wrappedDekB64: string
 *   }
 * }>}
 */
async function setupVault(password: string) {
	// Salt PHẢI random, unique per-user — không derive từ username/password
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const kek = await deriveKEK(password, salt);

	// DEK sinh ngẫu nhiên, độc lập với password
	const dek = await crypto.subtle.generateKey(
		{ name: 'AES-GCM', length: 256 },
		true, // phải extractable để wrap được
		['encrypt', 'decrypt']
	);

	// Wrap (mã hóa) DEK bằng KEK
	const dekIv = crypto.getRandomValues(new Uint8Array(12));
	const rawDek = await crypto.subtle.exportKey('raw', dek);
	const wrappedDek = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: dekIv }, kek, rawDek);

	return {
		dek,
		storageRecord: {
			saltB64: bufToBase64(salt),
			dekIvB64: bufToBase64(dekIv),
			wrappedDekB64: bufToBase64(wrappedDek)
		}
	};
}

// ============ Bước 3: Unlock — lấy lại DEK từ password (lúc login) ============

/**
 * Gọi mỗi lần user login / cần decrypt data.
 * @param {string} password
 * @param {{saltB64: string, dekIvB64: string, wrappedDekB64: string}} storageRecord
 * @returns {Promise<CryptoKey>} dek — dùng để encrypt/decrypt data
 * @throws Error nếu password sai (AES-GCM tự phát hiện qua auth tag)
 */
async function unlockVault(
	password: string,
	storageRecord: { saltB64: string; dekIvB64: string; wrappedDekB64: string }
) {
	const salt = base64ToBuf(storageRecord.saltB64);
	const dekIv = base64ToBuf(storageRecord.dekIvB64);
	const wrappedDek = base64ToBuf(storageRecord.wrappedDekB64);

	const kek = await deriveKEK(password, salt);

	let rawDek;
	try {
		rawDek = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dekIv }, kek, wrappedDek);
	} catch (err) {
		// AES-GCM ném lỗi nếu auth tag không khớp => sai password
		throw new Error('Sai mật khẩu hoặc dữ liệu bị hỏng');
	}

	return crypto.subtle.importKey(
		'raw',
		rawDek,
		{ name: 'AES-GCM' },
		// extractable: true — cần thiết để changePassword() có thể export rồi re-wrap DEK.
		// Nếu app của bạn KHÔNG cần đổi password, đổi thành false để an toàn hơn
		// (ngăn code khác vô tình export raw key ra ngoài).
		true,
		['encrypt', 'decrypt']
	);
}

// ============ Bước 4: Encrypt / Decrypt data thật bằng DEK ============

/**
 * @param {CryptoKey} dek
 * @param {string} plaintext
 * @returns {Promise<{ivB64: string, ciphertextB64: string}>} lưu vào DB
 */
async function encryptData(dek: CryptoKey, plaintext: string) {
	const iv = crypto.getRandomValues(new Uint8Array(12)); // luôn random, không tái sử dụng
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		dek,
		new TextEncoder().encode(plaintext)
	);

	return {
		ivB64: bufToBase64(iv),
		ciphertextB64: bufToBase64(ciphertext)
	};
}

/**
 * @param {CryptoKey} dek
 * @param {{ivB64: string, ciphertextB64: string}} record
 * @returns {Promise<string>} plaintext
 */
async function decryptData(dek: CryptoKey, record: { ciphertextB64: string; ivB64: string }) {
	const iv = base64ToBuf(record.ivB64);
	const ciphertext = base64ToBuf(record.ciphertextB64);

	const plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ciphertext);

	return new TextDecoder().decode(plaintextBuf);
}

// ============ Bước 5: Đổi password — chỉ re-wrap DEK, KHÔNG đụng data ============

/**
 * @param {string} oldPassword
 * @param {string} newPassword
 * @param {{saltB64: string, dekIvB64: string, wrappedDekB64: string}} oldStorageRecord
 * @returns {Promise<{saltB64: string, dekIvB64: string, wrappedDekB64: string}>} storageRecord mới, ghi đè DB
 */
async function changePassword(
	oldPassword: string,
	newPassword: string,
	oldStorageRecord: { saltB64: string; dekIvB64: string; wrappedDekB64: string }
) {
	// 1. Unlock DEK bằng password cũ (verify đồng thời)
	const dek = await unlockVault(oldPassword, oldStorageRecord);
	const rawDek = await crypto.subtle.exportKey('raw', dek);

	// 2. Sinh salt MỚI + KEK mới từ password mới
	const newSalt = crypto.getRandomValues(new Uint8Array(16));
	const newKek = await deriveKEK(newPassword, newSalt);

	// 3. Wrap lại DEK (DEK giữ nguyên -> data cũ vẫn decrypt được bình thường)
	const newDekIv = crypto.getRandomValues(new Uint8Array(12));
	const newWrappedDek = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: newDekIv },
		newKek,
		rawDek
	);

	return {
		saltB64: bufToBase64(newSalt),
		dekIvB64: bufToBase64(newDekIv),
		wrappedDekB64: bufToBase64(newWrappedDek)
	};
}
async function getServerPublicKeyB64(): Promise<string | undefined> {
	try {
		const res = await fetch('/api/encryption/public-key');
		if (res.ok) {
			const js = await res.json();
			return js['data']['publicKeyB64'];
		}
		return;
	} catch (e) {
		throw new Error('Something went wrong with api/public-key');
	}
}
async function getServerPublicKey(): Promise<CryptoKey | undefined> {
	const serverPublicKeyB64 = await getServerPublicKeyB64();
	if (serverPublicKeyB64) return await importPublicKey(serverPublicKeyB64);
	return;
}
async function generateRSAKeyPair() {
	const keyPair = await crypto.subtle.generateKey(
		{
			name: 'RSA-OAEP',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256'
		},
		true, // extractable — bắt buộc true nếu muốn export ra để lưu
		['encrypt', 'decrypt']
	);
	return keyPair; // { publicKey, privateKey }
}
/**
 *
 * @param key
 * @param format
 * @spki for public key
 * @pkcs8 for private key
 * @returns
 */
async function exportKeyToBase64(key: CryptoKey, format: 'spki' | 'pkcs8'): Promise<string> {
	const exported = await crypto.subtle.exportKey(format, key);
	let base64String: string;
	if (typeof Buffer !== 'undefined') {
		base64String = Buffer.from(exported).toString('base64');
	} else {
		base64String = btoa(String.fromCharCode(...new Uint8Array(exported)));
	}
	return base64String;
	// Trên browser (client-side), dùng cách này thay Buffer:
	// return btoa(String.fromCharCode(...new Uint8Array(exported)));
}
function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
	let binaryString: string;

	if (typeof Buffer !== 'undefined') {
		binaryString = Buffer.from(base64, 'base64').toString('binary');
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
async function importPublicKey(base64: string): Promise<CryptoKey> {
	const keyBytes = base64ToBytes(base64);
	return crypto.subtle.importKey(
		'spki', // format của public key
		keyBytes,
		{ name: 'RSA-OAEP', hash: 'SHA-256' }, // phải khớp thuật toán lúc generate
		true, // extractable
		['encrypt'] // usage — public key dùng để encrypt
	);
}
async function importPrivateKey(base64: string): Promise<CryptoKey> {
	const keyBytes = base64ToBytes(base64);
	return crypto.subtle.importKey(
		'pkcs8', // format của private key
		keyBytes,
		{ name: 'RSA-OAEP', hash: 'SHA-256' },
		true,
		['decrypt'] // usage — private key dùng để decrypt
	);
}
async function encryptWithPublicKeyHybrid(publicKey: CryptoKey, plaintext: string) {
	// 1. Sinh AES key tạm thời, ngẫu nhiên cho riêng lần mã hoá này
	const sessionKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
		'encrypt'
	]);

	// 2. Dùng AES key này mã hoá dữ liệu thật (không giới hạn kích thước)
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		sessionKey,
		new TextEncoder().encode(plaintext)
	);

	// 3. Dùng RSA public key mã hoá chính AES key đó (AES key rất nhỏ, RSA mã hoá được)
	const rawSessionKey = await crypto.subtle.exportKey('raw', sessionKey);
	const encryptedSessionKey = await crypto.subtle.encrypt(
		{ name: 'RSA-OAEP' },
		publicKey,
		rawSessionKey
	);

	return {
		encryptedSessionKeyB64: bufToBase64(encryptedSessionKey), // AES key đã mã hoá bằng RSA
		ivB64: bufToBase64(iv),
		ciphertextB64: bufToBase64(ciphertext)
	};
}
async function decryptWithPrivateKeyHybrid(
	privateKey: CryptoKey,
	record: { encryptedSessionKeyB64: string; ivB64: string; ciphertextB64: string }
) {
	try {
		// 1. Giải mã AES key bằng RSA private key
		const encryptedSessionKey = base64ToBuf(record.encryptedSessionKeyB64);
		const rawSessionKey = await crypto.subtle.decrypt(
			{ name: 'RSA-OAEP' },
			privateKey,
			encryptedSessionKey
		);

		const sessionKey = await crypto.subtle.importKey(
			'raw',
			rawSessionKey,
			{ name: 'AES-GCM' },
			false,
			['decrypt']
		);

		// 2. Dùng AES key vừa giải mã để giải mã dữ liệu thật
		const iv = base64ToBuf(record.ivB64);
		const ciphertext = base64ToBuf(record.ciphertextB64);
		const plaintextBuf = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv },
			sessionKey,
			ciphertext
		);
		return new TextDecoder().decode(plaintextBuf);
	} catch (e) {
		console.log(e);
	}
}
const fetchSecure = async (
	url: string,
	options: { body?: any; method?: string } = {},
	encryptKeys?: { publicKey: CryptoKey; privateKey: CryptoKey }
): Promise<ServerResponse> => {
	const publicKey = await getServerPublicKey();
	if (!publicKey) return { ok: false, message: { vi: 'Hệ thống chưa sẵn sàng!', en: 'System crashed!' } };

	let sessionPublicKey: CryptoKey;
	let sessionPublicKeyB64: string;
	let sessionPrivateKey: CryptoKey;
	if (encryptKeys) {
		sessionPublicKey = encryptKeys.publicKey;
		sessionPublicKeyB64 = await exportKeyToBase64(sessionPublicKey, 'spki');
		sessionPrivateKey = encryptKeys.privateKey;
	} else {
		const { privateKey, publicKey: newSessionPublicKey } = await generateRSAKeyPair();
		sessionPublicKey = newSessionPublicKey;
		sessionPrivateKey = privateKey;
		sessionPublicKeyB64 = await exportKeyToBase64(sessionPublicKey, 'spki');
	}

	// SỬA: trước đây chỉ mã hoá + gửi payload khi `options.body` có giá trị.
	// Nghĩa là với request không có body (vd GET), `sessionPublicKeyB64` KHÔNG BAO GIỜ
	// được gửi lên server -> server không có key để mã hoá response trả về ->
	// decryptWithPrivateKeyHybrid ở dưới sẽ luôn thất bại cho mọi request không có body.
	// Nay luôn build 1 envelope (mặc định body rỗng {}) và luôn gửi.
	const payload = { ...(options.body ?? {}), publicKeyB64: sessionPublicKeyB64 };
	// SỬA: Gọi trực tiếp encryptWithPublicKeyHybrid thay vì encryption.encryptWithPublicKeyHybrid
	const encryptedBody = await encryptWithPublicKeyHybrid(
		publicKey,
		JSON.stringify(payload)
	);

	const res = await fetch(url, {
		method: options.method ?? 'POST',
		headers: { 'content-type': 'application/json' }, // thiếu trước đây
		body: JSON.stringify(encryptedBody)
	});

	let decryptedPayload: any = null;
	try {
		const encryptedResponse = await res.json();
		const decryptedText = await decryptWithPrivateKeyHybrid(sessionPrivateKey, encryptedResponse);
		if (decryptedText) {
			decryptedPayload = JSON.parse(decryptedText);
		}
	} catch {
		// Response is not encrypted JSON
	}

	if (decryptedPayload) {
		return { ...decryptedPayload, ok: res.ok && (decryptedPayload.ok ?? true) };
	}

	if (!res.ok) {
		throw new Error(`fetchSecure: request failed with status ${res.status}`);
	}

	throw new Error('Encryption.decryptedText failed');
};

async function hmacBlindIndex(secretKey: Uint8Array, value: string): Promise<string> {
	// Chuẩn hoá về ArrayBuffer cụ thể, tránh lỗi type ArrayBufferLike vs ArrayBuffer
	const keyBuffer = secretKey.buffer.slice(
		secretKey.byteOffset,
		secretKey.byteOffset + secretKey.byteLength
	) as ArrayBuffer;

	const key = await crypto.subtle.importKey(
		'raw',
		keyBuffer,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign(
		'HMAC',
		key,
		new TextEncoder().encode(value.trim().toLowerCase())
	);
	return bufToBase64(sig);
}
async function setupIndexKey(vaultPassword: string) {
	// DEK ở đây CHÍNH LÀ Index Key — dùng thẳng, không mã hoá thêm gì nữa
	// SỬA: Gọi trực tiếp setupVault thay vì tham chiếu qua object export `encryption.setupVault`
	const { dek, storageRecord } = await setupVault(vaultPassword);
	const rawIndexKey = await crypto.subtle.exportKey('raw', dek);

	return {
		indexKeyRaw: new Uint8Array(rawIndexKey),
		storageRecord // { saltB64, dekIvB64, wrappedDekB64 } — lưu thẳng, đúng field name schema
	};
}

async function unlockIndexKey(
	vaultPassword: string,
	storageRecord: { saltB64: string; dekIvB64: string; wrappedDekB64: string }
) {
	// SỬA: Gọi trực tiếp unlockVault thay vì tham chiếu qua object export `encryption.unlockVault`
	const dek = await unlockVault(vaultPassword, storageRecord);
	const raw = await crypto.subtle.exportKey('raw', dek);
	return new Uint8Array(raw);
}

type JsonPrimitive = string | number | boolean | null;

type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function stableStringify(value: JsonValue): string {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value) ?? 'null';
	}

	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(',')}]`;
	}

	const keys = Object.keys(value).sort();

	return `{${keys
		.map((key) => {
			return `${JSON.stringify(key)}:${stableStringify(value[key])}`;
		})
		.join(',')}}`;
}

async function getDataHash(data: JsonValue): Promise<string> {
	const canonical = stableStringify(data);

	const encoded = new TextEncoder().encode(canonical);

	const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);

	const hashArray = Array.from(new Uint8Array(hashBuffer));

	return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
// ============ Export ============

export const encryption = {
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
