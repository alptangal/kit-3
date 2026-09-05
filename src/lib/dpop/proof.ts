// src/lib/dpop/proof.ts

import { base64urlEncode, base64urlEncodeJson } from './base64url';
import { encryption } from '$modules/encryption';

async function exportPublicJwk(publicKey: CryptoKey) {
	const jwk = await crypto.subtle.exportKey('jwk', publicKey);
	return { kty: jwk.kty!, crv: jwk.crv!, x: jwk.x!, y: jwk.y! };
}

export async function createDpopProof(opts: {
	htm: string;
	htu: string;
	accessToken?: string;
	nonce?: string;
}) {
	const { publicKey, privateKey } = await encryption.generateRSAKeyPair();
	const jwk = await exportPublicJwk(publicKey);

	const header = { typ: 'dpop+jwt', alg: 'ES256', jwk };
	const payload: Record<string, unknown> = {
		jti: crypto.randomUUID(),
		htm: opts.htm,
		htu: opts.htu,
		iat: Math.floor(Date.now() / 1000)
	};
	if (opts.nonce) payload.nonce = opts.nonce;

	if (opts.accessToken) {
		const digest = await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(opts.accessToken)
		);
		payload.ath = base64urlEncode(digest);
	}

	const encodedHeader = base64urlEncodeJson(header);
	const encodedPayload = base64urlEncodeJson(payload);
	const signingInput = `${encodedHeader}.${encodedPayload}`;

	// WebCrypto ECDSA trả về signature dạng raw (r || s), đúng định dạng JWS cần — không cần convert DER
	const signatureBuf = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		privateKey,
		new TextEncoder().encode(signingInput)
	);

	return `${signingInput}.${base64urlEncode(signatureBuf)}`;
}
