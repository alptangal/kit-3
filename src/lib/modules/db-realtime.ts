//$modules/db-realtime.ts

/**
 * Subscribe realtime "database changed" events từ PartyKit room "db-changes" (B8).
 *
 * Mỗi admin page đăng ký handler theo collection của mình: brands page chỉ nghe
 * 'brands', orders page nghe 'orders'... Khi event tới → handler gọi fetchXxx()
 * refetch list. Event KHÔNG mang data — chỉ là refetch hint (server là nguồn chân lý).
 *
 * KHÔNG skip-own (event do chính mình gây ra): refetch đôi sau mutation bản thân
 * là vô hại — list đã refetch theo response, refetch lần nữa chỉ tốn 1 request
 * đọc idempotent, đổi lại bỏ logic session-id so sánh phức tạp.
 *
 * Fallback tự nhiên: PartyKit không chạy / WS bị chặn (mixed content) → KHÔNG có
 * event → page vẫn refetch theo nhịp mình (mutation success / reload). Realtime
 * là enhancement, không phải dependency.
 */

import { browser } from '$app/environment';
import { PUBLIC_PARTYKIT_HOST } from '$env/static/public';
import PartySocket from 'partysocket';

export type DbRealtimeCollection =
	| 'brands'
	| 'categories'
	| 'products'
	| 'variants'
	| 'customers'
	| 'orders'
	| 'users'
	| 'inventory_lots'
	| 'inventory_stock'
	| 'system';

export interface DbRealtimeEvent {
	collection: DbRealtimeCollection;
	action: string;
	by?: string;
}

type DbChangeListener = (event: DbRealtimeEvent) => void;

/** Đăng ký theo collection — trả về unsubscribe. */
export function subscribeDbChanges(
	collection: DbRealtimeCollection,
	handler: () => void
): () => void {
	const listener: DbChangeListener = (event) => {
		if (event.collection === collection) handler();
	};
	dbChangeListeners.add(listener);
	ensureSocket();
	return () => dbChangeListeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Internal — mirror pattern server-key.ts (singleton PartySocket room riêng)
// ---------------------------------------------------------------------------

let wsSocket: PartySocket | null = null;
const dbChangeListeners = new Set<DbChangeListener>();

function ensureSocket(): void {
	if (!browser || typeof WebSocket === 'undefined') return;
	if (wsSocket) return;

	try {
		// $env/static/public: SvelteKit statically replace lúc build (import.meta.env
		// của Vite core chỉ expose prefix VITE_*, không thấy PUBLIC_*).
		const host = PUBLIC_PARTYKIT_HOST;
		if (!host) return; // không cấu hình PartyKit — realtime tắt âm thầm

		// Dev: partykit dev KHÔNG có TLS (ws://localhost:1999) — chỉ dùng ws khi
		// page cũng chạy http://localhost (Chrome exempt). Page https (preview
		// 4173 / prod) BẮT BUỘC wss — ws:// trên origin https bị chặn mixed
		// content (Chrome không exempt https://localhost). Khi deploy có proxy
		// TLS trước partykit, set PUBLIC_PARTYKIT_PROTOCOL=wss trong .env để
		// override (đọc qua import.meta.env vì $env/static/public chỉ export
		// biến đã khai báo).
		const protocol =
			(import.meta.env.PUBLIC_PARTYKIT_PROTOCOL as string | undefined) ??
			(typeof location !== 'undefined'
				? location.protocol === 'https:'
					? 'wss'
					: 'ws'
				: 'ws');

		wsSocket = new PartySocket({
			host,
			room: 'db-changes',
			protocol: protocol as 'ws' | 'wss'
		});
		wsSocket.addEventListener('message', (event) => {
			try {
				const data = JSON.parse(event.data as string);
				if (data && data.type === 'db-change' && typeof data.collection === 'string') {
					const dbEvent: DbRealtimeEvent = {
						collection: data.collection as DbRealtimeCollection,
						action: typeof data.action === 'string' ? data.action : '',
						by: typeof data.by === 'string' ? data.by : undefined
					};
					for (const listener of dbChangeListeners) listener(dbEvent);
				}
			} catch {
				// message không phải JSON — bỏ qua
			}
		});
	} catch (e) {
		console.warn('[db-realtime] PartySocket init failed, realtime disabled:', e);
		wsSocket = null;
	}
}

/** Chỉ dành cho test — reset toàn bộ state của module. */
export function _resetForTests(): void {
	if (wsSocket) {
		try {
			wsSocket.close();
		} catch {
			// ignore
		}
	}
	wsSocket = null;
	dbChangeListeners.clear();
}

/** Chỉ dành cho test — giả lập nhận db-change event qua WS broadcast. */
export function _emitDbChangeForTests(event: DbRealtimeEvent): void {
	for (const listener of dbChangeListeners) listener(event);
}
