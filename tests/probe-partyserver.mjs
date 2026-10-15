// Probe e2e PartyServer local: push key + GET key + db-change broadcast qua WS.
// Chạy: node tests/probe-partyserver.mjs [baseURL mặc định http://127.0.0.1:8787]
// Dùng partysocket từ node_modules root (dep chính) — giống client thật 100%.

import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';

const require = createRequire(import.meta.url);
const { PartySocket } = require('partysocket');

const BASE = process.argv[2] ?? 'http://127.0.0.1:8787';
const TOKEN = '62cd17aa15209b3a4c3aa9c86849ffe337e8fad6b25279d9';

const results = [];
const check = (name, ok, detail = '') => {
	results.push({ name, ok, detail });
	console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
	// Sinh RSA-2048 SPKI base64 thật (giống initSystemVault push)
	const { publicKey } = await webcrypto.subtle.generateKey(
		{ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
		true,
		['encrypt', 'decrypt']
	);
	const spki = await webcrypto.subtle.exportKey('spki', publicKey);
	const publicKeyB64 = Buffer.from(spki).toString('base64');

	// --- P1: POST key SAI token -> 401
	{
		const res = await fetch(`${BASE}/parties/main/server-keys`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: 'Bearer wrong-token' },
			body: JSON.stringify({ publicKeyB64 })
		});
		check('P1 POST key sai token -> 401', res.status === 401, `got ${res.status}`);
	}

	// --- P2: POST key key sai format -> 400
	{
		const res = await fetch(`${BASE}/parties/main/server-keys`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
			body: JSON.stringify({ publicKeyB64: 'too-short' })
		});
		check('P2 POST key sai format -> 400', res.status === 400, `got ${res.status}`);
	}

	// --- P3: POST key đúng token -> 200 + WS server-keys nhận broadcast 'key'
	const wsKey = new PartySocket({
		host: BASE.replace(/^http/, 'ws'),
		room: 'server-keys'
	});
	let keyMsg = null;
	wsKey.addEventListener('message', (e) => {
		try {
			const d = JSON.parse(e.data);
			if (d.type === 'key') keyMsg = d;
		} catch {}
	});
	await new Promise((r, j) => {
		wsKey.addEventListener('open', r, { once: true });
		wsKey.addEventListener('error', (e) => j(new Error('ws open failed')), { once: true });
	});
	// onConnect gửi key hiện tại (đã push từ probe curl trước đó có thể còn trong storage)
	await sleep(500);
	{
		const res = await fetch(`${BASE}/parties/main/server-keys`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
			body: JSON.stringify({ publicKeyB64 })
		});
		check('P3 POST key đúng token -> 200', res.status === 200, `got ${res.status}`);
	}
	await sleep(500);
	check(
		'P4 WS server-keys nhận broadcast/onConnect key',
		keyMsg?.publicKeyB64 === publicKeyB64,
		keyMsg ? `key match: ${keyMsg.publicKeyB64 === publicKeyB64}` : 'không nhận được key message'
	);

	// --- P5: GET key không auth -> 200 trả đúng key
	{
		const res = await fetch(`${BASE}/parties/main/server-keys`);
		const js = await res.json();
		check(
			'P5 GET key (no auth) -> 200 + key khớp',
			res.status === 200 && js?.data?.publicKeyB64 === publicKeyB64,
			`got ${res.status}`
		);
	}

	// --- P6: WS db-changes nhận broadcast event
	const wsDb = new PartySocket({
		host: BASE.replace(/^http/, 'ws'),
		room: 'db-changes'
	});
	let dbEvent = null;
	wsDb.addEventListener('message', (e) => {
		try {
			const d = JSON.parse(e.data);
			if (d.type === 'db-change') dbEvent = d;
		} catch {}
	});
	await new Promise((r, j) => {
		wsDb.addEventListener('open', r, { once: true });
		wsDb.addEventListener('error', (e) => j(new Error('ws open failed')), { once: true });
	});
	await sleep(300);
	{
		const res = await fetch(`${BASE}/parties/main/db-changes`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
			body: JSON.stringify({ collection: 'orders', action: 'create', by: 'probe' })
		});
		check('P6 POST db-change đúng token -> 200', res.status === 200, `got ${res.status}`);
	}
	await sleep(500);
	check(
		'P7 WS db-changes nhận broadcast event',
		dbEvent?.collection === 'orders' && dbEvent?.action === 'create' && dbEvent?.by === 'probe',
		dbEvent ? JSON.stringify(dbEvent) : 'không nhận được event'
	);

	// --- P8: POST db-change sai token -> 401
	{
		const res = await fetch(`${BASE}/parties/main/db-changes`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: 'Bearer wrong' },
			body: JSON.stringify({ collection: 'orders', action: 'create' })
		});
		check('P8 POST db-change sai token -> 401', res.status === 401, `got ${res.status}`);
	}

	// --- P9: POST db-change field sai format -> 400
	{
		const res = await fetch(`${BASE}/parties/main/db-changes`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
			body: JSON.stringify({ collection: 'orders', action: 'x'.repeat(100) })
		});
		check('P9 POST db-change field quá dài -> 400', res.status === 400, `got ${res.status}`);
	}

	// --- P10: WS message gửi key update bị bỏ qua (server không đổi key)
	{
		wsKey.send(JSON.stringify({ type: 'key', publicKeyB64: 'FAKE-KEY'.padEnd(300, 'A') }));
		await sleep(500);
		const res = await fetch(`${BASE}/parties/main/server-keys`);
		const js = await res.json();
		check(
			'P10 WS key-update bị ignore (GET vẫn key cũ)',
			js?.data?.publicKeyB64 === publicKeyB64,
			'key không đổi — WS update bị từ chối đúng thiết kế'
		);
	}

	wsKey.close();
	wsDb.close();

	const failed = results.filter((r) => !r.ok);
	console.log(`\n=== KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS ===`);
	if (failed.length) {
		console.log('FAILED:', failed.map((f) => f.name).join('; '));
		process.exit(1);
	}
}

main().catch((e) => {
	console.error('PROBE CRASHED:', e);
	process.exit(1);
});
