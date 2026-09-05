// src/lib/server/dpop.ts — bổ sung thêm hàm cho trường hợp login (chưa có token)
import { base64urlDecode } from '$lib/dpop/base64url';
import { calculateJwkThumbprint } from '$lib/dpop/thumbprint';

const usedJti = new Map<string, number>(); // production: Redis TTL

function cleanupJti() {
	const now = Date.now();
	for (const [jti, exp] of usedJti) if (exp < now) usedJti.delete(jti);
}

function decodeJsonPart(b64url: string) {
	return JSON.parse(new TextDecoder().decode(base64urlDecode(b64url)));
}

async function verifyProofSignatureAndClaims(proof: string, htm: string, htu: string) {
	const parts = proof.split('.');
	if (parts.length !== 3) throw new Error('Invalid DPoP proof format');
	const [encodedHeader, encodedPayload, encodedSignature] = parts;

	const header = decodeJsonPart(encodedHeader);
	const payload = decodeJsonPart(encodedPayload);

	if (header.typ !== 'dpop+jwt') throw new Error('Invalid typ');
	if (header.alg !== 'ES256') throw new Error('Unsupported alg');
	if (!header.jwk) throw new Error('Missing jwk');

	const publicKey = await crypto.subtle.importKey(
		'jwk',
		header.jwk,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['verify']
	);

	const signingInput = `${encodedHeader}.${encodedPayload}`;
	const valid = await crypto.subtle.verify(
		{ name: 'ECDSA', hash: 'SHA-256' },
		publicKey,
		base64urlDecode(encodedSignature).buffer as ArrayBuffer,
		new TextEncoder().encode(signingInput)
	);
	if (!valid) throw new Error('Invalid signature');

	cleanupJti();
	if (typeof payload.jti !== 'string' || usedJti.has(payload.jti)) {
		throw new Error('Replayed or missing jti');
	}
	usedJti.set(payload.jti, Date.now() + 120_000);

	const now = Math.floor(Date.now() / 1000);
	if (typeof payload.iat !== 'number' || Math.abs(now - payload.iat) > 60) {
		throw new Error('DPoP proof expired or iat invalid');
	}
	if (payload.htm !== htm || payload.htu !== htu) {
		throw new Error('htm/htu mismatch');
	}

	const jkt = await calculateJwkThumbprint(header.jwk);
	return { jkt, header, payload };
}

// Dùng lúc LOGIN / REFRESH — chưa có access token để check 'ath'
export async function verifyDpopProofNoBinding(opts: { proof: string; htm: string; htu: string }) {
	return verifyProofSignatureAndClaims(opts.proof, opts.htm, opts.htu);
}

// Dùng cho API bảo vệ — CÓ access token, phải check 'ath' + 'jkt' khớp cnf trong token
export async function verifyDpopProof(opts: {
	proof: string;
	htm: string;
	htu: string;
	accessToken: string;
	expectedJkt: string;
}) {
	const { jkt, payload } = await verifyProofSignatureAndClaims(opts.proof, opts.htm, opts.htu);

	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(opts.accessToken));
	const ath = Buffer.from(digest).toString('base64url');
	if (payload.ath !== ath) throw new Error('ath mismatch');

	if (jkt !== opts.expectedJkt) throw new Error('jkt mismatch — wrong key bound to token');

	return { jkt, payload };
}
