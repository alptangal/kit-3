//$modules/server-key.ts

/**
 * Fetch public key (base64 SPKI) của server — WS-first qua PartyKit, fallback HTTP.
 *
 * Chiến lược:
 *   - Browser có WS (PartySocket tới room "server-keys"): PartyKit gửi key ngay khi
 *     connect và broadcast mỗi khi key được push lại. Client cache b64.
 *   - Song song, sau ~700ms nếu WS chưa deliver key thì fetch HTTP
 *     /api/encryption/public-key (fallback — endpoint giữ nguyên cho script/test cũ).
 *   - Server-side (SSR) hoặc khi WS bị chặn (mixed content https->ws): HTTP-only.
 *
 * Module chỉ trả về chuỗi b64 — việc import CryptoKey + cache nằm ở encryption.ts
 * để tránh circular import (encryption.ts import module này).
 */

import { browser } from '$app/environment';
import PartySocket from 'partysocket';

let cachedB64: string | undefined;
let inFlight: Promise<string | undefined> | undefined;

let wsSocket: PartySocket | null = null;
let wsKeyPromise: Promise<string | undefined> | undefined;
let wsKeyResolve: ((value: string | undefined) => void) | undefined;

type KeyChangeListener = (newB64: string) => void;
const keyChangeListeners = new Set<KeyChangeListener>();

/** Đăng ký callback khi key thay đổi (broadcast mới từ PartyKit) — dùng để clear CryptoKey cache. */
export function onServerKeyChange(listener: KeyChangeListener): () => void {
	keyChangeListeners.add(listener);
	return () => keyChangeListeners.delete(listener);
}

function applyKey(publicKeyB64: string) {
	if (!publicKeyB64) return;
	const changed = cachedB64 !== publicKeyB64;
	cachedB64 = publicKeyB64;
	if (changed) {
		for (const listener of keyChangeListeners) listener(publicKeyB64);
	}
	// Resolve promise WS-first bất kể key có đổi không (reconnect gửi lại key cũ vẫn phải resolve)
	if (wsKeyResolve) {
		wsKeyResolve(publicKeyB64);
		wsKeyResolve = undefined;
	}
}

function getWsSocket(): PartySocket | null {
	if (!browser || typeof WebSocket === 'undefined') return null;
	if (wsSocket) return wsSocket;

	try {
		const host = import.meta.env.PUBLIC_PARTYKIT_HOST;
		if (!host) {
			// Không cấu hình PartyKit — client chỉ dùng HTTP fallback
			return null;
		}
		// https://localhost:3000 (dev) -> ws:// bị chặn mixed-content, dùng wss:// sẽ
		// thất bại nhanh và rơi về HTTP. PUBLIC_PARTYKIT_PROTOCOL cho phép override
		// khi có proxy TLS đằng trước partykit.
		const protocol =
			(import.meta.env.PUBLIC_PARTYKIT_PROTOCOL as string | undefined) ??
			(typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss' : 'ws');

		wsKeyPromise = new Promise<string | undefined>((resolve) => {
			wsKeyResolve = resolve;
		});

		wsSocket = new PartySocket({
			host,
			room: 'server-keys',
			protocol: protocol as 'ws' | 'wss'
		});
		wsSocket.addEventListener('message', (event) => {
			try {
				const data = JSON.parse(event.data as string);
				if (data && data.type === 'key' && typeof data.publicKeyB64 === 'string') {
					applyKey(data.publicKeyB64);
				}
			} catch {
				// message không phải JSON — bỏ qua
			}
		});
	} catch (e) {
		console.warn('[server-key] PartySocket init failed, using HTTP fallback:', e);
		return null;
	}
	return wsSocket;
}

/** HTTP fallback — giữ đúng format của /api/encryption/public-key. */
async function fetchKeyOverHttp(): Promise<string | undefined> {
	try {
		const res = await fetch('/api/encryption/public-key');
		if (res.ok) {
			const js = await res.json();
			const key = js?.['data']?.['publicKeyB64'];
			if (typeof key === 'string' && key.length > 0) {
				applyKey(key);
				return key;
			}
		}
		return undefined;
	} catch {
		return undefined;
	}
}

/**
 * Lấy public key b64. WS-first với HTTP fallback:
 *   - Nếu đã cache (WS đã deliver) → trả ngay.
 *   - Browser + WS khả dụng: đợi WS key tối đa WS_HEAD_START_MS, sau đórace với HTTP
 *     fetch — bên nào xong trước thì dùng.
 *   - Không có WS (SSR / không cấu hình / mixed-content bị block) → HTTP fetch.
 * Promise in-flight được memoize để tránh spam request khi nhiều caller cùng lúc.
 */
const WS_HEAD_START_MS = 700;

export async function getServerPublicKeyB64(): Promise<string | undefined> {
	if (cachedB64) return cachedB64;
	if (inFlight) return inFlight;

	const socket = getWsSocket();

	const promise = (async () => {
		if (socket && wsKeyPromise) {
			// Cho WS head start ~700ms, rồi mới race với HTTP
			const timeout = new Promise<string | undefined>((resolve) =>
				setTimeout(() => resolve(undefined), WS_HEAD_START_MS)
			);
			const wsResult = await Promise.race([wsKeyPromise, timeout]);
			if (wsResult) return wsResult;
		}
		// HTTP fallback (hoặc đường chính khi không có WS)
		return await fetchKeyOverHttp();
	})();

	inFlight = promise;
	try {
		return await promise;
	} finally {
		inFlight = undefined;
	}
}

/** Chỉ dành cho test — reset toàn bộ state của module. */
export function _resetForTests(): void {
	cachedB64 = undefined;
	inFlight = undefined;
	if (wsSocket) {
		try {
			wsSocket.close();
		} catch {
			// ignore
		}
	}
	wsSocket = null;
	wsKeyPromise = undefined;
	wsKeyResolve = undefined;
	keyChangeListeners.clear();
}

/** Chỉ dành cho test — giả lập nhận key mới qua WS broadcast. */
export function applyKeyForTests(publicKeyB64: string): void {
	applyKey(publicKeyB64);
}
