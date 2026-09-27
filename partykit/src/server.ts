import type * as Party from 'partykit/server';

/**
 * Room "server-keys" — lưu trữ public key (RSA-2048 SPKI, base64) của system vault.
 *
 * Luồng:
 *   1. SvelteKit (initSystemVault) POST key lên đây khi boot, kèm Bearer token
 *      PARTYKIT_INTERNAL_TOKEN — KHÔNG có token đúng thì 401. Đây là con đường duy nhất
 *      để set key: bắt buộc, vì kẻ tấn công đẩy key của nó vào sẽ khiến client mã hoá
 *      request cho key của kẻ tấn công (MITM decrypt).
 *   2. PartyKit lưu key vào Durable Object storage và broadcast cho mọi WS client.
 *   3. WS onMessage KHÔNG BAO GIỜ chấp nhận key update — chỉ log.
 *   4. GET (không cần auth — public key là dữ liệu công khai) trả key hiện tại.
 */

const KEY_STORAGE_FIELD = 'publicKeyB64';

// RSA-2048 SPKI base64 ~392 chars; chấp nhận dải rộng để không chặn key khác hợp lệ
const MIN_KEY_LENGTH = 300;
const MAX_KEY_LENGTH = 600;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function isValidPublicKeyB64(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	if (value.length < MIN_KEY_LENGTH || value.length > MAX_KEY_LENGTH) return false;
	return BASE64_RE.test(value);
}

export default class Server implements Party.Server {
	constructor(readonly room: Party.Party) {}

	async onRequest(req: Party.Request): Promise<Response> {
		if (req.method === 'POST') {
			// Push key từ SvelteKit — bắt buộc Bearer token đúng
			const authHeader = req.headers.get('authorization') ?? '';
			const expected = this.room.env.PARTYKIT_INTERNAL_TOKEN ?? '';
			if (!expected || authHeader !== `Bearer ${expected}`) {
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

	onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
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
		console.log(`[server-keys] ignored message from ${sender.id}`);
	}
}

Server satisfies Party.Worker;
