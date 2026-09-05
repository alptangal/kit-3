// src/lib/dpop/base64url.ts
export function base64urlEncode(data: ArrayBuffer | Uint8Array | string): string {
	const bytes =
		typeof data === 'string'
			? new TextEncoder().encode(data)
			: data instanceof Uint8Array
				? data
				: new Uint8Array(data);

	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	const base64 =
		typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64'); // fallback cho Node nếu cần

	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// src/lib/dpop/base64url.ts
export function base64urlDecode(str: string): Uint8Array<ArrayBuffer> {
	const base64 = str
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.padEnd(str.length + ((4 - (str.length % 4 || 4)) % 4), '=');
	const binary =
		typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');

	const bytes = new Uint8Array(binary.length); // luôn tạo ArrayBuffer mới, không phải view lồng
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
export function base64urlEncodeJson(obj: unknown): string {
	return base64urlEncode(JSON.stringify(obj));
}
