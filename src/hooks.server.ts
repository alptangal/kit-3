// hooks.server.ts
import type { MetaUser } from '$interfaces/basic';
import type { Handle } from '@sveltejs/kit';
import { systemVault, initSystemVault } from '$store/initSystemVault';
import { initApp } from '$store/init-app';
import { verifyAccessToken } from '$lib/server/jwt';
import { resolveLang, localize } from '$lib/server/i18n';

declare global {
	// eslint-disable-next-line no-var
	var __appInitialized: boolean | undefined;
}

if (!globalThis.__appInitialized) {
	globalThis.__appInitialized = true;
	await initApp();
}

// Ensure system vault is initialized before handling requests
await initSystemVault();

async function getUserFromToken(token: string): Promise<MetaUser | undefined> {
	try {
		const payload = await verifyAccessToken(token);

		// Extract user info from JWT payload
		// JWT payload contains: userId, username, roleId, statusId, iat, exp, jti
		const user: MetaUser = {
			firstName: payload.username,
			lastName: '',
			dob: '',
			region: 'South-Eastern Asia',
			country: 'VN',
			gender: 'Male',
			phone: '',
			email: '',
			username: payload.username,
			password: '', // Don't expose password
			role: payload.roleId.includes('owner') ? 'admin' : payload.roleId.includes('manager') ? 'staff' : 'customer'
		};

		return user;
	} catch (error) {
		console.error('[hooks.server] Token verification failed:', error);
		return undefined;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	// Defensive check — nếu vì lý do gì đó vault chưa sẵn sàng (init lỗi/đang chạy),
	// từ chối sớm thay vì để lỗi mơ hồ xảy ra sâu bên trong từng route
	if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
		return new Response('Service unavailable — system initializing', { status: 503 });
	}

	const token = event.cookies.get('session');
	event.locals.user = token ? await getUserFromToken(token) : undefined;

	const { pathname } = event.url;

	// Public paths that don't require authentication
	const publicPaths = ['/login', '/register', '/forgot-password', '/api/encryption', '/api/login', '/api/register', '/api/forgot-password', '/reset-password', '/api/reset-password', '/api/dev-emails', '/verify-email', '/api/verify-email', '/api/resend-verification', '/ui'];
	const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

	// API routes that don't require authentication
	const isApiRoute = pathname.startsWith('/api/');

	// For (authorized) routes, check authentication
	if (!isPublicPath && !isApiRoute && !event.locals.user) {
		// Store the original URL for redirect after login
		const redirectUrl = encodeURIComponent(pathname + event.url.search);
		return new Response(null, {
			status: 303,
			headers: { location: `/login?redirect=${redirectUrl}` }
		});
	}

	// Check token expiration for API routes too
	if (isApiRoute && !isPublicPath && !event.locals.user) {
		// 401 body cũng chỉ chứa đúng ngôn ngữ client đang dùng
		const lang = resolveLang(event.request.headers.get('accept-language'));
		return new Response(JSON.stringify({
			message: localize({ vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' }, lang),
			ok: false
		}), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return resolve(event);
};

export const handleError = ({ error }) => {
	import('fs').then(fs => {
		const errorMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);
		fs.writeFileSync('d:/nodejs/svelte/kit-3/last_ssr_error.log', errorMessage);
	});
	return {
		message: error instanceof Error ? error.message : 'Unknown error'
	};
};
