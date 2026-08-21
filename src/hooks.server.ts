// hooks.server.ts
import type { MetaUser } from '$interfaces/basic';
import type { Handle } from '@sveltejs/kit';
import { systemVault } from '$store/initSystemVault';
import { initApp } from '$store/init-app';

declare global {
	// eslint-disable-next-line no-var
	var __appInitialized: boolean | undefined;
}

if (!globalThis.__appInitialized) {
	globalThis.__appInitialized = true;
}

async function getUserFromToken(token: string): Promise<MetaUser | undefined> {
	return undefined;
}

export const handle: Handle = async ({ event, resolve }) => {
	await initApp();
	// Defensive check — nếu vì lý do gì đó vault chưa sẵn sàng (init lỗi/đang chạy),
	// từ chối sớm thay vì để lỗi mơ hồ xảy ra sâu bên trong từng route
	if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
		return new Response('Service unavailable — system initializing', { status: 503 });
	}

	const token = event.cookies.get('session');
	event.locals.user = token ? await getUserFromToken(token) : undefined;

	const { pathname } = event.url;
	if (pathname.startsWith('/admin') && event.locals.user?.role !== 'admin') {
		return new Response(null, { status: 303, headers: { location: '/login' } });
	}
	if (pathname.startsWith('/profile') && !event.locals.user) {
		return new Response(null, { status: 303, headers: { location: '/login' } });
	}

	return resolve(event);
};
