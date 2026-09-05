import { systemVault } from '$store/initSystemVault';
import { base64urlEncode, base64urlEncodeJson, base64urlDecode } from '$lib/dpop/base64url';

// Server cần MỘT cặp khoá ES256 riêng để ký token (khác với khoá của user!)
// Load từ env hoặc file, ví dụ đơn giản dùng biến global đã import sẵn CryptoKeyPair
let serverKeyPair: CryptoKeyPair;

export async function getServerKeyPair() {
	if (serverKeyPair) return serverKeyPair;
	// Trong thực tế: load từ JWK lưu trong secret manager, không generate mỗi lần restart
	serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
		'sign',
		'verify'
	]);
	return serverKeyPair;
}

export async function signAccessToken(payload: Record<string, unknown>): Promise<string> {
	const { privateKey } = systemVault;
	const header = { alg: 'ES256', typ: 'JWT' };
	const signingInput = `${base64urlEncodeJson(header)}.${base64urlEncodeJson(payload)}`;
	const sig = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		privateKey,
		new TextEncoder().encode(signingInput)
	);
	return `${signingInput}.${base64urlEncode(sig)}`;
}

export async function verifyAccessToken(token: string): Promise<Record<string, any>> {
	const [encodedHeader, encodedPayload, encodedSig] = token.split('.');
	if (!encodedHeader || !encodedPayload || !encodedSig) throw new Error('Malformed token');

	const { publicKey } = await getServerKeyPair();
	const signingInput = `${encodedHeader}.${encodedPayload}`;
	const valid = await crypto.subtle.verify(
		{ name: 'ECDSA', hash: 'SHA-256' },
		publicKey,
		base64urlDecode(encodedSig).buffer as ArrayBuffer,
		new TextEncoder().encode(signingInput)
	);
	if (!valid) throw new Error('Invalid token signature');

	const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(encodedPayload)));
	if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error('Token expired');
	return payload;
}
