// src/lib/server/totp.ts
// TOTP (RFC 6238) tự viết — không thêm dependency.
// - generateTotpSecret(): base32 random 20 bytes (160-bit, khuyến nghị RFC 4226).
// - verifyTotpCode(secretB32, code): so khớp window ±1 step (30s), so thời gian
//   không đổi (tránh timing leak) — dùng chung cho enable + login flow.
// - buildOtpauthUrl(): URI cho authenticator app (Google Authenticator / Authy...).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
	const buf = randomBytes(20);
	let bits = '';
	for (const byte of buf) bits += byte.toString(2).padStart(8, '0');
	let out = '';
	for (let i = 0; i + 5 <= bits.length; i += 5) {
		out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
	}
	return out;
}

function base32Decode(secretB32: string): Buffer {
	const clean = secretB32.replace(/=+$/g, '').toUpperCase().replace(/\s+/g, '');
	let bits = '';
	for (const ch of clean) {
		const idx = BASE32_ALPHABET.indexOf(ch);
		if (idx === -1) continue;
		bits += idx.toString(2).padStart(5, '0');
	}
	const bytes: number[] = [];
	for (let i = 0; i + 8 <= bits.length; i += 8) {
		bytes.push(parseInt(bits.slice(i, i + 8), 2));
	}
	return Buffer.from(bytes);
}

export function totpCodeAt(secretB32: string, counter: number): string {
	const key = base32Decode(secretB32);
	const buf = Buffer.alloc(8);
	buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
	buf.writeUInt32BE(counter >>> 0, 4);
	const hmac = createHmac('sha1', key).update(buf).digest();
	const offset = hmac[hmac.length - 1] & 0x0f;
	const bin =
		((hmac[offset] & 0x7f) << 24) |
		((hmac[offset + 1] & 0xff) << 16) |
		((hmac[offset + 2] & 0xff) << 8) |
		(hmac[offset + 3] & 0xff);
	return String(bin % 1_000_000).padStart(6, '0');
}

/** Xác minh mã 6 số — window ±1 step (90s tổng) để bù trôi giờ/thao tác chậm. */
export function verifyTotpCode(secretB32: string, code: string): boolean {
	const clean = code.replace(/\D/g, '');
	if (clean.length !== 6) return false;
	const step = Math.floor(Date.now() / 1000 / 30);
	const a = Buffer.from(clean, 'utf8');
	for (let drift = -1; drift <= 1; drift++) {
		const b = Buffer.from(totpCodeAt(secretB32, step + drift), 'utf8');
		if (a.length === b.length && timingSafeEqual(a, b)) return true;
	}
	return false;
}

export function buildOtpauthUrl(secretB32: string, account: string, issuer: string): string {
	const label = encodeURIComponent(`${issuer}:${account}`);
	const params = new URLSearchParams({
		secret: secretB32,
		issuer,
		algorithm: 'SHA1',
		digits: '6',
		period: '30'
	});
	return `otpauth://totp/${label}?${params.toString()}`;
}
