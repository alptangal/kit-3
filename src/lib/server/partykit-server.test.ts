// Test cho partykit/src/server.ts (PartyServer — room "server-keys") — chạy trực tiếp
// class Main với DO ctx + env giả lập. PartyServer class extends DurableObject
// (cloudflare:workers — chỉ tồn tại trong workerd runtime), nên mock module này
// bằng stub trống: class Main không gọi gì từ DurableObject trong constructor,
// các method được test (onRequest/onConnect/onMessage) chỉ dùng this.env /
// this.ctx.storage / this.name / this.broadcast.
//
// QUAN TRỌNG: các test này khóa chặt yêu cầu bảo mật — push endpoint phải 401 khi
// thiếu/sai token, và onMessage KHÔNG BAO GIỜ được cập nhật key.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phải đặt TRƯỚC import partykit/src/server (vi.mock hoisted tự động). Stub
// DurableObject phải MIRROR workers runtime thật: constructor lưu this.ctx =
// state + this.env = env — PartyServer getter `name` đọc this.ctx.id.name.
vi.mock('cloudflare:workers', () => ({
	DurableObject: class {
		ctx: unknown;
		env: unknown;
		constructor(state: unknown, env: unknown) {
			this.ctx = state;
			this.env = env;
		}
	}
}));

import { Main } from '../../../partykit/src/server';

const TOKEN = 'test-token-123';
const VALID_KEY = 'A'.repeat(392); // RSA-2048 SPKI base64 ~392 chars

interface MockStorage {
	put: ReturnType<typeof vi.fn>;
	get: ReturnType<typeof vi.fn>;
}

function makeCtx(roomName: string, storage: MockStorage) {
	return {
		id: { name: roomName },
		storage,
		// PartyServer Server.__ensureInitialized có thể dùng — nhưng onRequest path
		// của Main không gọi các DO runtime API khác ngoài storage.
		waitUntil: vi.fn(),
		blockConcurrencyWhile: vi.fn((fn) => fn())
	} as never;
}

function makeEnv(): { PARTYKIT_INTERNAL_TOKEN: string; Main: DurableObjectNamespace } {
	// Main = DO binding namespace — server code không dùng nó trong các method
	// được test, chỉ cần presence để thỏa interface Env.
	return { PARTYKIT_INTERNAL_TOKEN: TOKEN, Main: {} as DurableObjectNamespace };
}

function makeServer(roomName = 'server-keys', storedKey?: string) {
	const storage: MockStorage = {
		put: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockResolvedValue(storedKey)
	};
	const server = new Main(makeCtx(roomName, storage), makeEnv());
	// broadcast là method kế thừa từ PartyServer Server (lặp qua getConnections) —
	// thay bằng spy để assert đã broadcast mà không cần connection thật.
	server.broadcast = vi.fn();
	return { server, storage };
}

function postRequest(body: unknown, token?: string) {
	return new Request('http://127.0.0.1:8787/parties/main/server-keys', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...(token ? { authorization: `Bearer ${token}` } : {})
		},
		body: JSON.stringify(body)
	});
}

describe('partyserver server-keys room', () => {
	let server: InstanceType<typeof Main>;
	let storage: MockStorage;

	beforeEach(() => {
		({ server, storage } = makeServer('server-keys', VALID_KEY));
	});

	describe('POST (push key từ SvelteKit)', () => {
		it('401 khi KHÔNG có Authorization header', async () => {
			const res = await server.onRequest(postRequest({ publicKeyB64: VALID_KEY }));
			expect(res.status).toBe(401);
			expect(storage.put).not.toHaveBeenCalled();
			expect(server.broadcast).not.toHaveBeenCalled();
		});

		it('401 khi token SAI — kẻ tấn công không đẩy được key giả', async () => {
			const res = await server.onRequest(postRequest({ publicKeyB64: VALID_KEY }, 'attacker-token'));
			expect(res.status).toBe(401);
			expect(storage.put).not.toHaveBeenCalled();
			expect(server.broadcast).not.toHaveBeenCalled();
		});

		it('401 khi env chưa set PARTYKIT_INTERNAL_TOKEN (deny-all)', async () => {
			const bare = new Main(makeCtx('server-keys', storage), {} as never);
			const res = await bare.onRequest(postRequest({ publicKeyB64: VALID_KEY }, 'anything'));
			expect(res.status).toBe(401);
		});

		it('200 + lưu storage + broadcast khi token đúng, key hợp lệ', async () => {
			const res = await server.onRequest(postRequest({ publicKeyB64: VALID_KEY }, TOKEN));
			expect(res.status).toBe(200);

			expect(storage.put).toHaveBeenCalledWith('publicKeyB64', VALID_KEY);
			expect(server.broadcast).toHaveBeenCalledTimes(1);
			const broadcasted = JSON.parse((server.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
			expect(broadcasted).toEqual({ type: 'key', publicKeyB64: VALID_KEY });
		});

		it('400 khi body không phải JSON', async () => {
			const req = new Request('http://127.0.0.1:8787/parties/main/server-keys', {
				method: 'POST',
				headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
				body: 'not-json'
			});
			const res = await server.onRequest(req);
			expect(res.status).toBe(400);
			expect(storage.put).not.toHaveBeenCalled();
		});

		it('400 khi key quá ngắn', async () => {
			const res = await server.onRequest(postRequest({ publicKeyB64: 'AAA' }, TOKEN));
			expect(res.status).toBe(400);
			expect(storage.put).not.toHaveBeenCalled();
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
			const res = await server.onRequest(
				new Request('http://127.0.0.1:8787/parties/main/server-keys')
			);
			expect(res.status).toBe(200);
			const js = (await res.json()) as { data: { publicKeyB64: string } };
			expect(js.data.publicKeyB64).toBe(VALID_KEY);
		});

		it('404 khi chưa có key', async () => {
			storage.get.mockResolvedValue(undefined);
			const res = await server.onRequest(
				new Request('http://127.0.0.1:8787/parties/main/server-keys')
			);
			expect(res.status).toBe(404);
		});
	});

	describe('db-changes room', () => {
		it('401 khi POST event thiếu/sai token', async () => {
			const dbServer = makeServer('db-changes');
			const res = await dbServer.server.onRequest(
				new Request('http://127.0.0.1:8787/parties/main/db-changes', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ collection: 'orders', action: 'create' })
				})
			);
			expect(res.status).toBe(401);
		});

		it('405 khi GET (chỉ nhận POST)', async () => {
			const dbServer = makeServer('db-changes');
			const res = await dbServer.server.onRequest(
				new Request('http://127.0.0.1:8787/parties/main/db-changes')
			);
			expect(res.status).toBe(405);
		});

		it('400 khi collection/action sai format', async () => {
			const dbServer = makeServer('db-changes');
			const res = await dbServer.server.onRequest(
				new Request('http://127.0.0.1:8787/parties/main/db-changes', {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						authorization: `Bearer ${TOKEN}`
					},
					body: JSON.stringify({ collection: 'orders', action: 'x'.repeat(100) })
				})
			);
			expect(res.status).toBe(400);
		});

		it('200 + broadcast event khi token đúng', async () => {
			const dbServer = makeServer('db-changes');
			const res = await dbServer.server.onRequest(
				new Request('http://127.0.0.1:8787/parties/main/db-changes', {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						authorization: `Bearer ${TOKEN}`
					},
					body: JSON.stringify({ collection: 'orders', action: 'create', by: 'tester' })
				})
			);
			expect(res.status).toBe(200);
			expect(dbServer.server.broadcast).toHaveBeenCalledTimes(1);
			const broadcasted = JSON.parse(
				(dbServer.server.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
			);
			expect(broadcasted).toEqual({
				type: 'db-change',
				collection: 'orders',
				action: 'create',
				by: 'tester'
			});
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
			storage.get.mockResolvedValue(undefined);
			const send = vi.fn();
			await server.onConnect({ id: 'conn-1', send } as never, {} as never);
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(send).not.toHaveBeenCalled();
		});
	});

	describe('onMessage (WS — KHÔNG BAO GIỜ nhận key update)', () => {
		it('bỏ qua mọi message: không storage.put, không broadcast', async () => {
			const attackerKey = 'B'.repeat(392);
			await server.onMessage(
				{ id: 'conn-evil' } as never,
				JSON.stringify({ type: 'key', publicKeyB64: attackerKey })
			);

			expect(storage.put).not.toHaveBeenCalled();
			expect(server.broadcast).not.toHaveBeenCalled();
		});
	});
});
