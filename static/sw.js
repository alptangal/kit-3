// static/sw.js — service worker TỐI THIỂU (PWA Pha 6).
//
// Chiến lược: KHÔNG cache động — mọi response API (/api/*) và trang SvelteKit
// đều đi thẳng mạng. Lý do: toàn bộ API trả payload MÃ HOÁ hybrid RSA+AES —
// cache nhầm response cũ sẽ phá flow bắt tay khoá, và dữ liệu nhạy cảm
// KHÔNG được nằm trong Cache Storage. Chỉ precache duy nhất trang offline
// fallback + icon manifest, dùng khi mất mạng mở app lần đầu.
//
// Version: tăng '_ver' khi đổi danh sách precache để activate sw mới ngay.
const VER = 'v1';
const CACHE = `pdm-offline-${VER}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(PRECACHE);
			// Kích hoạt ngay không chờ tab cũ đóng
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Dọn cache phiên bản cũ
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return; // mọi POST API encrypted bỏ qua
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return; // CDN/font ngoài bỏ qua
	if (url.pathname.startsWith('/api/')) return; // API encrypted — KHÔNG BAO GIỜ cache

	// navigation offline → fallback trang offline
	if (req.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					return await fetch(req);
				} catch {
					const cache = await caches.open(CACHE);
					return (await cache.match(OFFLINE_URL)) ?? Response.error();
				}
			})()
		);
		return;
	}

	// static precache (icons/manifest/offline assets): cache-first
	if (PRECACHE.some((p) => url.pathname === p)) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE);
				const hit = await cache.match(req);
				if (hit) return hit;
				try {
					const res = await fetch(req);
					if (res.ok) cache.put(req, res.clone());
					return res;
				} catch {
					return Response.error();
				}
			})()
		);
	}
});
