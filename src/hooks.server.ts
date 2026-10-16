// hooks.server.ts
import type { MetaUser } from '$interfaces/basic';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { systemVault, initSystemVault } from '$store/initSystemVault';
import { initApp } from '$store/init-app';
import { verifyAccessToken } from '$lib/server/jwt';
import { resolveLang, localize } from '$lib/server/i18n';
import { getClientIp } from '$lib/server/rate-limit';
import { cbData } from '$modules/couchbase/clients';
import { QrPaymentService } from '$lib/server/db/qr-payments';

const cbRoles = cbData('name_roles');

declare global {
	// eslint-disable-next-line no-var
	var __appInitialized: boolean | undefined;
	var __initPromise: Promise<void> | undefined;
}

// Vault "đủ" khi có CẢ khoá RSA (encrypted API) lẫn cặp ES256 (JWT) — module reload
// (Vite SSR) làm systemVault reset về undefined nhưng __appInitialized (global) vẫn
// true → guard cũ chỉ check privateKey sẽ bỏ sót re-init và jwtPrivateKey stay undefined.
const vaultReady = () =>
	!!(systemVault?.privateKey && systemVault?.jwtPrivateKey && systemVault?.indexKey);

if (!globalThis.__appInitialized || !vaultReady()) {
	globalThis.__appInitialized = true;
	globalThis.__initPromise = (async () => {
		await initApp();
		await initSystemVault();
		// Auto polling QR payment (chỉ chạy khi QR_CHECKER_AUTO_POLL=true + có URL tool —
		// guard bên trong startAutoPolling; no-op khi chưa cấu hình).
		QrPaymentService.startAutoPolling();
	})();
}

// Ensure initialization completes before handling requests
async function ensureInitialized(): Promise<void> {
	if (!vaultReady()) {
		globalThis.__initPromise = (async () => {
			await initApp();
			await initSystemVault();
		})();
	}
	if (globalThis.__initPromise) {
		await globalThis.__initPromise;
	}
}

async function getUserFromToken(token: string): Promise<MetaUser | undefined> {
	try {
		const payload = await verifyAccessToken(token);

		// Extract user info from JWT payload
		// JWT payload (signAccessToken): sub = user docKey, username = firstname,
		// roleId = role docKey, statusId, iat, exp.
		// userId/roleId bắt buộc — getActorContext + admin layout tra quyền qua 2
		// field này; thiếu là 401 "Session expired" ở API lẫn redirect ở trang admin.
		// roleName tra từ name_roles theo roleId (admin layout + PermissionChecker
		// keyof theo roleName, vd 'owner'); tra fail → fallback roleId để không
		// khoá user vì lỗi tạm thời (PermissionChecker sẽ trả false nếu không khớp).
		let roleName: string | undefined;
		try {
			const res = await cbRoles.document.get({ documentKey: payload.roleId });
			if (res.ok && res.data) roleName = (res.data as { name?: string }).name ?? undefined;
		} catch {
			roleName = undefined;
		}

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
			role: payload.roleId.includes('owner') ? 'admin' : payload.roleId.includes('manager') ? 'staff' : 'customer',
			userId: payload.sub,
			roleId: payload.roleId,
			roleName: roleName ?? payload.roleId
		};

		return user;
	} catch (error) {
		console.error('[hooks.server] Token verification failed:', error);
		return undefined;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	// Ensure initialization completes before handling requests
	await ensureInitialized();

	// Defensive check — nếu vì lý do gì đó vault chưa sẵn sàng (init lỗi/đang chạy),
	// từ chối sớm thay vì để lỗi mơ hồ xảy ra sâu bên trong từng route
	if (!vaultReady()) {
		return new Response('Service unavailable — system initializing', { status: 503 });
	}

	const token = event.cookies.get('session');
	event.locals.user = token ? await getUserFromToken(token) : undefined;

	const { pathname } = event.url;

	// Public paths that don't require authentication
	// '/store' (group route '(storefront)') + '/api/storefront': storefront công khai (Phase 5) —
	// trang xem/giỏ/thanh toán vẫn đọc locals.user nếu có (cart API tự 401).
	// '/api/webhooks/qr-payment': webhook thanh toán QR từ tool đối soát ngoài —
	// route tự xác thực bằng QR_WEBHOOK_TOKEN (Bearer), không dùng session.
	const publicPaths = ['/login', '/register', '/forgot-password', '/api/encryption', '/api/login', '/api/register', '/api/forgot-password', '/reset-password', '/api/reset-password', '/api/dev-emails', '/verify-email', '/api/verify-email', '/api/resend-verification', '/ui', '/api/health', '/api/test', '/store', '/api/storefront', '/api/auth/webauthn/auth', '/api/auth/refresh', '/api/auth/logout', '/api/agent', '/api/webhooks/qr-payment'];
	const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

	// API routes that don't require authentication
	const isApiRoute = pathname.startsWith('/api/');

	// Auth pages a logged-in user should not see again (reverse guard):
	// /login, /register, /forgot-password → redirect to /admin.
	// KHÔNG gồm /reset-password (user vừa bấm link email — cho phép mở dù
	// đang login) và /verify-email (xác minh tài khoản mới). Chỉ trang —
	// API login/register/forgot-password vẫn hoạt động bình thường.
	const authPages = ['/login', '/register', '/forgot-password'];
	const isAuthPage = !isApiRoute && authPages.some(path => pathname === path || pathname.startsWith(path + '/'));
	if (isAuthPage && event.locals.user) {
		return new Response(null, {
			status: 303,
			headers: { location: '/admin' }
		});
	}

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

	const startedAt = Date.now();
	const response = await resolve(event);
	logAccess(event, response.status, Date.now() - startedAt);
	return response;
};

// ── Access logging (fire-and-forget, không bao giờ block/crash response) ──
const ACCESS_LOG_SKIP_PREFIXES = ['/_app', '/favicon', '/api/webhooks', '/api/health', '/api/encryption'];
let accessLogCleanupTick = 0;

function logAccess(event: RequestEvent, status: number, durationMs: number) {
	const { pathname } = event.url;
	if (ACCESS_LOG_SKIP_PREFIXES.some(prefix => pathname.startsWith(prefix))) return;
	// Chỉ log route app + API (bỏ file tĩnh .png/.css/... ngoài /_app)
	if (pathname.includes('.') && !pathname.startsWith('/api/')) return;
	const user = event.locals.user;
	import('$lib/server/db/activity-logs')
		.then(({ AccessLogService }) => AccessLogService.record({
			userId: user?.userId ?? 'anonymous',
			path: pathname,
			method: event.request.method,
			status,
			durationMs,
			at: new Date().toISOString(),
			userAgent: event.request.headers.get('user-agent') ?? undefined,
			ip: getClientIp(event.request, event.getClientAddress) || undefined
		}))
		.catch(() => {});
	// ~1% request: dọn log cũ > 30 ngày
	if (++accessLogCleanupTick % 100 === 7) {
		import('$lib/server/db/activity-logs')
			.then(({ AccessLogService }) => AccessLogService.cleanupOld())
			.catch(() => {});
	}
}

export const handleError = ({ error }: { error: unknown }) => {
	import('fs').then(fs => {
		const errorMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);
		fs.writeFileSync('d:/nodejs/svelte/kit-3/last_ssr_error.log', errorMessage);
	});
	return {
		message: error instanceof Error ? error.message : 'Unknown error'
	};
};
