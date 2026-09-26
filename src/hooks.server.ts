// hooks.server.ts
import type { MetaUser } from '$interfaces/basic';
import type { Handle } from '@sveltejs/kit';
import { systemVault, initSystemVault } from '$store/initSystemVault';
import { initApp } from '$store/init-app';
import { verifyAccessToken } from '$lib/server/jwt';
import { resolveLang, localize } from '$lib/server/i18n';
import { cbData } from '$modules/couchbase/clients';

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

// ── Role name lookup (roleId → roleName) ──
// Session cookie chỉ chứa roleId (documentKey trong name_roles, vd 'role-owner'),
// nhưng PermissionChecker/UserAdminService cần roleName ('owner') để tra detail_roles.
// Cache 60s mirroring grantsCache trong permission-checker.ts — name_roles ít thay đổi.
const ROLE_CACHE_TTL_MS = 60_000;
const cbRoles = cbData('name_roles');
const roleNameCache = new Map<string, { roleName: string | null; expiresAt: number }>();

async function getRoleNameByRoleId(roleId: string): Promise<string | null> {
	const cached = roleNameCache.get(roleId);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.roleName;
	}
	let roleName: string | null = null;
	try {
		const res = await cbRoles.document.get({ documentKey: roleId });
		if (res.ok && res.data) {
			const name = (res.data as { name?: string }).name;
			if (typeof name === 'string' && name) roleName = name;
		}
	} catch (e) {
		console.error('[hooks.server] Role lookup failed:', e);
	}
	// Chỉ cache khi tra thành công — lỗi tạm thời (mạng/token) không bị khoá cả TTL
	if (roleName !== null) {
		roleNameCache.set(roleId, { roleName, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
	}
	return roleName;
}

/** Session token dạng base64 JSON hiện tại: { userId, username, roleId, issuedAt } */
interface Base64SessionPayload {
	userId?: string;
	username?: string;
	roleId?: string;
	issuedAt?: number;
}

/** Session tối đa 30 ngày (khớp maxAge cookie khi remember=true) */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Parse session cookie dạng base64 JSON mà /api/login thực sự ghi ngày nay
 * (login chưa ký JWT — cookie là base64 JSON thuần, xem ghi chú trong login +server.ts).
 * Trả về payload + roleName đã tra từ name_roles, hoặc undefined nếu không hợp lệ.
 */
async function getUserFromBase64Session(
	token: string
): Promise<
	{ userId: string; username: string; roleId: string; roleName: string | null } | undefined
> {
	let payload: Base64SessionPayload;
	try {
		// Buffer.from(token, 'base64') bỏ qua ký tự không hợp lệ thay vì throw,
		// nên JSON.parse là bước xác thực thực sự — payload rác sẽ throw ở đây.
		payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8')) as Base64SessionPayload;
	} catch {
		return undefined;
	}

	if (!payload || typeof payload !== 'object') return undefined;
	if (!payload.userId || !payload.username || !payload.roleId) return undefined;

	// Token quá hạn 30 ngày — coi như session đã hết hạn
	if (typeof payload.issuedAt !== 'number' || Date.now() - payload.issuedAt > SESSION_MAX_AGE_MS) {
		return undefined;
	}

	const roleName = await getRoleNameByRoleId(payload.roleId);
	return { userId: payload.userId, username: payload.username, roleId: payload.roleId, roleName };
}

/**
 * Dual-path: thử verifyAccessToken (JWT ES256) trước — future-proof cho khi login
 * chuyển hẳn sang JWT thật; nếu fail thì fallback về parse base64 JSON session
 * cookie mà login hiện đang ghi. KHÔNG đổi verifyAccessToken hay format cookie login.
 */
export async function getUserFromToken(token: string): Promise<MetaUser | undefined> {
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
			userId: payload.userId,
			roleId: payload.roleId,
			roleName:
				typeof payload.roleId === 'string'
					? (await getRoleNameByRoleId(payload.roleId)) ?? undefined
					: undefined
		};

		return user;
	} catch {
		// Không phải JWT hợp lệ — thử parse base64 JSON session của login
	}

	const session = await getUserFromBase64Session(token);
	if (!session) {
		console.error('[hooks.server] Session token không hợp lệ hoặc đã hết hạn');
		return undefined;
	}

	return {
		firstName: session.username,
		lastName: '',
		dob: '',
		region: 'South-Eastern Asia',
		country: 'VN',
		gender: 'Male',
		phone: '',
		email: '',
		username: session.username,
		password: '', // Don't expose password
		userId: session.userId,
		roleId: session.roleId,
		roleName: session.roleName ?? undefined
	};
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
