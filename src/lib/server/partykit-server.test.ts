// Test cho partykit/src/server.ts (room "server-keys") — chạy trực tiếp class Server
// với room giả lập. import 'partykit/server' là type-only nên bị erase khi transform.
//
// QUAN TRỌNG: các test này khóa chặt yêu cầu bảo mật — push endpoint phải 401 khi
// thiếu/sai token, và onMessage KHÔNG BAO GIỜ được cập nhật key.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Server from '../../../partykit/src/server';

const TOKEN = 'test-token-123';
const VALID_KEY = 'A'.repeat(392); // RSA-2048 SPKI base64 ~392 chars

interface MockRoom {
	id: string;
	env: Record<string, unknown>;
	storage: { put: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
	broadcast: ReturnType<typeof vi.fn>;
}

function makeRoom(storedKey?: string): MockRoom {
	return {
		id: 'server-keys',
		env: { PARTYKIT_INTERNAL_TOKEN: TOKEN },
		storage: {
			put: vi.fn().mockResolvedValue(undefined),
			get: vi.fn().mockResolvedValue(storedKey)
		},
		broadcast: vi.fn()
	};
}

function makeServer(room: MockRoom) {
	return new Server(room as never);
}

function postRequest(body: unknown, token?: string) {
	return new Request('http://localhost:1999/party/server-keys', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...(token ? { authorization: `Bearer ${token}` } : {})
		},
		body: JSON.stringify(body)
	});
}

describe('partykit server-keys room', () => {
	let room: MockRoom;
	let server: Server;

	beforeEach(() => {
		room = makeRoom(VALID_KEY);
		server = makeServer(room);
	});

	describe('POST (push key từ SvelteKit)', () => {
		it('401 khi KHÔNG có Authorization header', async () => {
			const res = await server.onRequest(postRequest({ publicKeyB64: VALID_KEY }));
			expect(res.status).toBe(401);
			expect(room.storage.put).not.toHaveBeenCalled();
			expect(room.broadcast).not.toHaveBeenCalled();
		});

		it('401 khi token SAI — kẻ tấn công không đẩy được key giả', async () => {
			const res = await server.onRequest(postRequest({ publicKeyB64: VALID_KEY }, 'attacker-token'));
			expect(res.status).toBe(401);
			expect(room.storage.put).not.toHaveBeenCalled();
			expect(room.broadcast).not.toHaveBeenCalled();
		});

		it('401 khi env chưa set PARTYKIT_INTERNAL_TOKEN (deny-all)', async () => {
			room.env = {};
			const res = await server.onRequest(postRequest({ publicKeyB64: VALID_KEY }, 'anything'));
			expect(res.status).toBe(401);
		});

		it('200 + lưu storage + broadcast khi token đúng, key hợp lệ', async () => {
			const res = await server.onRequest(postRequest({ publicKeyB64: VALID_KEY }, TOKEN));
			expect(res.status).toBe(200);

			expect(room.storage.put).toHaveBeenCalledWith('publicKeyB64', VALID_KEY);
			expect(room.broadcast).toHaveBeenCalledTimes(1);
			const broadcasted = JSON.parse(room.broadcast.mock.calls[0][0] as string);
			expect(broadcasted).toEqual({ type: 'key', publicKeyB64: VALID_KEY });
		});

		it('400 khi body không phải JSON', async () => {
			const req = new Request('http://localhost:1999/party/server-keys', {
				method: 'POST',
				headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
				body: 'not-json'
			});
			const res = await server.onRequest(req);
			expect(res.status).toBe(400);
			expect(room.storage.put).not.toHaveBeenCalled();
		});

		it('400 khi key quá ngắn', async () => {
			const res = await server.onRequest(postRequest({ publicKeyB64: 'AAA' }, TOKEN));
			expect(res.status).toBe(400);
			expect(room.storage.put).not.toHaveBeenCalled();
		});

		it('400 khi key chứa ký tự không phải base64', async () => {
			const res = await server.onRequest(postRequest({ publicKeyB64: '!!!'.repeat(150) }, TOKEN));
			expect(res.status).toBe(400);
		});

		it('400 khi thiếu publicKeyB64', async () => {
			const res = await server.onRequest(postRequest({}, TOKEN));
			expect(res.status).toBe(400);
		});
	});

	describe('GET (public — không cần auth)', () => {
		it('trả key hiện tại', async () => {
			const res = await server.onRequest(new Request('http://localhost:1999/party/server-keys'));
			expect(res.status).toBe(200);
			const js = await res.json();
			expect(js.data.publicKeyB64).toBe(VALID_KEY);
		});

		it('404 khi chưa có key', async () => {
			room.storage.get.mockResolvedValue(undefined);
			const res = await server.onRequest(new Request('http://localhost:1999/party/server-keys'));
			expect(res.status).toBe(404);
		});
	});

	describe('onConnect', () => {
		it('gửi key đã lưu ngay khi client kết nối', async () => {
			const send = vi.fn();
			const conn = { id: 'conn-1', send } as never;

			await server.onConnect(conn, {} as never);
			// storage.get là async — đợi microtask drain
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(send).toHaveBeenCalledTimes(1);
			const sent = JSON.parse(send.mock.calls[0][0] as string);
			expect(sent).toEqual({ type: 'key', publicKeyB64: VALID_KEY });
		});

		it('không gửi gì khi chưa có key', async () => {
			room.storage.get.mockResolvedValue(undefined);
			const send = vi.fn();
			await server.onConnect({ id: 'conn-1', send } as never, {} as never);
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(send).not.toHaveBeenCalled();
		});
	});

	describe('onMessage (WS — KHÔNG BAO GIỜ nhận key update)', () => {
		it('bỏ qua mọi message: không storage.put, không broadcast', async () => {
			const attackerKey = 'B'.repeat(392);
			await server.onMessage(JSON.stringify({ type: 'key', publicKeyB64: attackerKey }), {
				id: 'conn-evil'
			} as never);

			expect(room.storage.put).not.toHaveBeenCalled();
			expect(room.broadcast).not.toHaveBeenCalled();
		});
	});
});
