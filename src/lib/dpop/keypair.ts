// src/lib/dpop/keypair.ts
// Keypair DPoP bền phía client — ES256 (ECDSA P-256) đúng chuẩn RFC 9449.
// Tạo 1 lần, cache module-level + persist JWK vào sessionStorage để jkt ổn định
// giữa login → refresh → logout trong cùng tab. Tab mới = keypair mới (chấp nhận:
// refresh token bind theo jkt — tab mới phải login lại, an toàn hơn stale key).
import { base64urlEncode } from './base64url';
import { calculateJwkThumbprint } from './thumbprint';

const STORAGE_KEY = 'dpop-keypair-jwk';

interface DpopKeypair {
	publicKey: CryptoKey;
	privateKey: CryptoKey;
	jwk: { kty: string; crv: string; x: string; y: string };
	jkt: string;
}

let cached: DpopKeypair | undefined;

async function importFromJwk(privJwk: JsonWebKey, pubJwk: JsonWebKey): Promise<DpopKeypair> {
	const privateKey = await crypto.subtle.importKey(
		'jwk',
		privJwk,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		true,
		['sign']
	);
	const publicKey = await crypto.subtle.importKey(
		'jwk',
		pubJwk,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['verify']
	);
	const jkt = await calculateJwkThumbprint({
		kty: pubJwk.kty as string,
		crv: pubJwk.crv as string,
		x: pubJwk.x as string,
		y: pubJwk.y as string
	});
	return {
		publicKey,
		privateKey,
		jwk: { kty: pubJwk.kty as string, crv: pubJwk.crv as string, x: pubJwk.x as string, y: pubJwk.y as string },
		jkt
	};
}

/**
 * Lấy keypair DPoP — tạo mới nếu chưa có, sau đó tái dùng.
 * SSR-safe: chỉ chạy client (sessionStorage).
 */
export async function getDpopKeypair(): Promise<DpopKeypair> {
	if (cached) return cached;

	// Thử khôi phục từ sessionStorage (reload trang — giữ nguyên jkt)
	try {
		if (typeof sessionStorage !== 'undefined') {
			const saved = sessionStorage.getItem(STORAGE_KEY);
			if (saved) {
				const { priv, pub } = JSON.parse(saved) as { priv: JsonWebKey; pub: JsonWebKey };
				cached = await importFromJwk(priv, pub);
				return cached;
			}
		}
	} catch {
		// JWK hỏng → tạo mới bên dưới
	}

	const keyPair = await crypto.subtle.generateKey(
		{ name: 'ECDSA', namedCurve: 'P-256' },
		true, // extractable — để persist JWK
		['sign', 'verify']
	);

	const pubJwkRaw = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey;
	const privJwkRaw = (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey;
	// Chỉ giữ field cần thiết (bỏ alg/use/kid thừa — importKey tự biết từ crv)
	const pubJwk: JsonWebKey = { kty: pubJwkRaw.kty, crv: pubJwkRaw.crv, x: pubJwkRaw.x, y: pubJwkRaw.y };
	const privJwk: JsonWebKey = {
		kty: privJwkRaw.kty,
		crv: privJwkRaw.crv,
		x: privJwkRaw.x,
		y: privJwkRaw.y,
		d: privJwkRaw.d
	};

	cached = await importFromJwk(privJwk, pubJwk);

	try {
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ priv: privJwk, pub: pubJwk }));
		}
	} catch {
		// sessionStorage đầy/chặn — vẫn chạy (keypair chỉ sống trong bộ nhớ)
	}

	return cached;
}

/** Public JWK để gửi server bind refresh token (login). */
export async function getDpopPublicJwk(): Promise<{ kty: string; crv: string; x: string; y: string }> {
	return (await getDpopKeypair()).jwk;
}

/** jkt (thumbprint RFC 7638) — server tính lại để đối chiếu, client chỉ dùng cho debug/log. */
export async function getDpopJkt(): Promise<string> {
	return (await getDpopKeypair()).jkt;
}

/** Xoá keypair (logout) — tab sau sẽ tạo mới. */
export function clearDpopKeypair(): void {
	cached = undefined;
	try {
		if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
	} catch {}
}

export { base64urlEncode };
