import { systemVault } from '$store/initSystemVault';
import { base64urlEncode, base64urlEncodeJson, base64urlDecode } from '$lib/dpop/base64url';

// Server dùng cặp khoá ES256 từ systemVault (được load từ DB) để ký/verify token
// Đảm bảo sign và verify dùng CÙNG khoá để token không bị invalid sau restart

export async function signAccessToken(payload: Record<string, unknown>): Promise<string> {
	const { jwtPrivateKey } = systemVault;
	const header = { alg: 'ES256', typ: 'JWT' };
	const signingInput = `${base64urlEncodeJson(header)}.${base64urlEncodeJson(payload)}`;
	const sig = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		jwtPrivateKey,
		new TextEncoder().encode(signingInput)
	);
	return `${signingInput}.${base64urlEncode(sig)}`;
}

export async function verifyAccessToken(token: string): Promise<Record<string, any>> {
	const [encodedHeader, encodedPayload, encodedSig] = token.split('.');
	if (!encodedHeader || !encodedPayload || !encodedSig) throw new Error('Malformed token');

	const { jwtPublicKey } = systemVault;
	const signingInput = `${encodedHeader}.${encodedPayload}`;
	const valid = await crypto.subtle.verify(
		{ name: 'ECDSA', hash: 'SHA-256' },
		jwtPublicKey,
		base64urlDecode(encodedSig).buffer as ArrayBuffer,
		new TextEncoder().encode(signingInput)
	);
	if (!valid) throw new Error('Invalid token signature');

	const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(encodedPayload)));
	if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error('Token expired');
	return payload;
}
