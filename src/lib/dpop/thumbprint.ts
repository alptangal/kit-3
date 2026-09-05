// src/lib/dpop/thumbprint.ts
import { base64urlEncode } from './base64url';

export async function calculateJwkThumbprint(jwk: {
	kty: string;
	crv: string;
	x: string;
	y: string;
}) {
	// Thứ tự field cố định theo RFC 7638, KHÔNG được thay đổi
	const canonical = JSON.stringify({
		crv: jwk.crv,
		kty: jwk.kty,
		x: jwk.x,
		y: jwk.y
	});
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
	return base64urlEncode(digest);
}
