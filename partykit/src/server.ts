import type * as Party from 'partykit/server';

/**
 * Hai room chia sẻ MỘT class này (phân nhánh theo this.room.id):
 *
 * 1. Room "server-keys" — lưu trữ public key (RSA-2048 SPKI, base64) của system vault.
 *
 * Luồng:
 *   1. SvelteKit (initSystemVault) POST key lên đây khi boot, kèm Bearer token
 *      PARTYKIT_INTERNAL_TOKEN — KHÔNG có token đúng thì 401. Đây là con đường duy nhất
 *      để set key: bắt buộc, vì kẻ tấn công đẩy key của nó vào sẽ khiến client mã hoá
 *      request cho key của kẻ tấn công (MITM decrypt).
 *   2. PartyKit lưu key vào Durable Object storage và broadcast cho mọi WS client.
 *   3. WS onMessage KHÔNG BAO GIỜ chấp nhận key update — chỉ log.
 *   4. GET (không cần auth — public key là dữ liệu công khai) trả key hiện tại.
 *
 * 2. Room "db-changes" (B8 realtime) — SvelteKit POST event {collection, action, by}
 *    sau mỗi mutation thành công; PartyKit broadcast ngay cho mọi WS client (refetch hint,
 *    không lưu storage). Cùng Bearer token server-to-server như room server-keys.
 */

const KEY_STORAGE_FIELD = 'publicKeyB64';
const DB_CHANGES_ROOM_ID = 'db-changes';

// RSA-2048 SPKI base64 ~392 chars; chấp nhận dải rộng để không chặn key khác hợp lệ
const MIN_KEY_LENGTH = 300;
const MAX_KEY_LENGTH = 600;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function isValidPublicKeyB64(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	if (value.length < MIN_KEY_LENGTH || value.length > MAX_KEY_LENGTH) return false;
	return BASE64_RE.test(value);
}

// Event db-change: collection + action là short string — chặn payload spam
const MAX_EVENT_FIELD_LENGTH = 64;
const EVENT_FIELD_RE = /^[a-z0-9_:-]+$/i;

function isValidEventField(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	if (value.length === 0 || value.length > MAX_EVENT_FIELD_LENGTH) return false;
	return EVENT_FIELD_RE.test(value);
}

export default class Server implements Party.Server {
	constructor(readonly room: Party.Party) {}

	/** Bearer token server-to-server (SvelteKit → PartyKit) — dùng cho cả 2 room. */
	private isAuthorized(req: Party.Request): boolean {
		const expected = this.room.env.PARTYKIT_INTERNAL_TOKEN ?? '';
		if (!expected) return false; // deny-all khi env chưa set
		const authHeader = req.headers.get('authorization') ?? '';
		return authHeader === `Bearer ${expected}`;
	}

	async onRequest(req: Party.Request): Promise<Response> {
		if (this.room.id === DB_CHANGES_ROOM_ID) {
			return this.handleDbChange(req);
		}
		if (req.method === 'POST') {
			// Push key từ SvelteKit — bắt buộc Bearer token đúng
			if (!this.isAuthorized(req)) {
				return new Response(JSON.stringify({ ok: false, message: 'Unauthorized' }), {
					status: 401
				});
			}

			let body: { publicKeyB64?: unknown };
			try {
				body = await req.json();
			} catch {
				return new Response(JSON.stringify({ ok: false, message: 'Invalid JSON body' }), {
					status: 400
				});
			}

			if (!isValidPublicKeyB64(body.publicKeyB64)) {
				return new Response(
					JSON.stringify({ ok: false, message: 'Invalid publicKeyB64 (expect base64 SPKI, 300-600 chars)' }),
					{ status: 400 }
				);
			}

			const publicKeyB64: string = body.publicKeyB64;
			await this.room.storage.put(KEY_STORAGE_FIELD, publicKeyB64);
			this.room.broadcast(JSON.stringify({ type: 'key', publicKeyB64 }));
			console.log(`[server-keys] pushed new public key (${publicKeyB64.length} chars), broadcast to room ${this.room.id}`);
			return new Response(JSON.stringify({ ok: true }), { status: 200 });
		}

		if (req.method === 'GET') {
			// Public key là dữ liệu công khai — không cần auth
			const publicKeyB64 = await this.room.storage.get<string>(KEY_STORAGE_FIELD);
			if (!publicKeyB64) {
				return new Response(JSON.stringify({ ok: false, message: 'No key stored yet' }), {
					status: 404
				});
			}
			return Response.json({ ok: true, data: { publicKeyB64 } });
		}

		return new Response(JSON.stringify({ ok: false, message: `Method ${req.method} not allowed` }), {
			status: 405
		});
	}

	/**
	 * Room "db-changes" (B8 realtime): SvelteKit POST event sau mutation thành công,
	 * PartyKit broadcast ngay cho mọi WS client. KHÔNG lưu storage (refetch hint) —
	 * client nào join sau chỉ refetch lần đầu theo nhịp load riêng, không cần replay.
	 */
	private async handleDbChange(req: Party.Request): Promise<Response> {
		if (req.method !== 'POST') {
			return new Response(JSON.stringify({ ok: false, message: `Method ${req.method} not allowed` }), {
				status: 405
			});
		}

		if (!this.isAuthorized(req)) {
			return new Response(JSON.stringify({ ok: false, message: 'Unauthorized' }), {
				status: 401
			});
		}

		let body: { collection?: unknown; action?: unknown; by?: unknown };
		try {
			body = await req.json();
		} catch {
			return new Response(JSON.stringify({ ok: false, message: 'Invalid JSON body' }), {
				status: 400
			});
		}

		if (!isValidEventField(body.collection) || !isValidEventField(body.action)) {
			return new Response(
				JSON.stringify({ ok: false, message: 'Invalid db-change event (collection/action expect short string)' }),
				{ status: 400 }
			);
		}

		const event = {
			type: 'db-change' as const,
			collection: body.collection,
			action: body.action,
			...(isValidEventField(body.by) ? { by: body.by } : {})
		};
		this.room.broadcast(JSON.stringify(event));
		console.log(`[db-changes] broadcast ${event.collection}/${event.action} (by ${event.by ?? 'unknown'})`);
		return new Response(JSON.stringify({ ok: true }), { status: 200 });
	}

	onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
		if (this.room.id === DB_CHANGES_ROOM_ID) {
			console.log(`[db-changes] connected: ${conn.id}`);
			return;
		}
		console.log(`[server-keys] connected: ${conn.id}`);
		// Gửi key hiện tại ngay khi client kết nối (nếu đã có)
		this.room.storage
			.get<string>(KEY_STORAGE_FIELD)
			.then((publicKeyB64: string | undefined) => {
				if (publicKeyB64) {
					conn.send(JSON.stringify({ type: 'key', publicKeyB64 }));
				}
			})
			.catch((e: unknown) => console.error('[server-keys] failed to send key on connect:', e));
	}

	onMessage(message: string, sender: Party.Connection) {
		// CHÚ Ý BẢO MẬT: không bao giờ xử lý key update qua WS — client nào cũng
		// kết nối được room này. Chỉ log.
		console.log(`[${this.room.id}] ignored message from ${sender.id}`);
	}
}

Server satisfies Party.Worker;
