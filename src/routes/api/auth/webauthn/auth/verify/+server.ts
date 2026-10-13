// src/routes/api/auth/webauthn/auth/verify/+server.ts
// POST — xác thực assertion, tạo session khi thành công (PUBLIC).
// Body: { response: AuthenticationResponseJSON }.
// Thành công: TẠO SESSION giống /api/login (signAccessToken + cookie 'session').
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { signAccessToken } from '$lib/server/jwt';
import {
	readPublicEncryptedRequest,
	respondPublicEncrypted
} from '$lib/server/admin/api';
import { WebAuthnService } from '$lib/server/db/webauthn';
import { webauthn } from '$lib/server/messages/db';
import { Users, authMessages } from '$lib/server/db/users';
import { cbData } from '$modules/couchbase/clients';
import { applyRateLimit } from '$lib/server/rate-limit';

// Đọc user_status catalog cho check canLogin (Users.canLogin là private)
const cbUserStatus = cbData('user_status');

// Cookie 'session' giữ cùng đặc tính với /api/login — xem src/routes/api/login/+server.ts
const SESSION_COOKIE = 'session';

export const POST: RequestHandler = async (event) => {
	try {
		// Rate limit 10 req/min — chống brute-force assertion
		const rateLimited = await applyRateLimit(
			event.request,
			event.getClientAddress,
			event.url.pathname
		);
		if (rateLimited) return rateLimited;

		const read = await readPublicEncryptedRequest<Record<string, unknown>>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64, data } = read;

		const respond = (payload: Parameters<typeof respondPublicEncrypted>[1], status = 200) =>
			respondPublicEncrypted(publicKeyB64, payload, lang, status);

		const response = data.response;
		if (!response || typeof response !== 'object') {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu dữ liệu xác thực thiết bị',
						en: 'Missing device verification data'
					}
				},
				400
			);
		}

		const result = await WebAuthnService.verifyAuthentication({ response });
		if (!result.success) {
			return respond({ ok: false, message: result.message }, 401);
		}

		// Lấy user instance để kiểm tra còn được phép đăng nhập + build session payload
		// (cùng semantics với /api/login: canLogin theo user_status + deletedAt check)
		const userInstance = await Users.getById(result.userId);
		if (!userInstance || userInstance.user.deletedAt) {
			return respond({ ok: false, message: webauthn.notFound }, 401);
		}
		const userDoc = userInstance.user;
		// canLogin là private — đọc user_status catalog trực tiếp (cùng logic Users.canLogin)
		const status = await cbUserStatus.document.get({ documentKey: userDoc.statusId });
		const allowedToLogin = Boolean(
			status.ok && (status.data as { canLogin?: boolean } | undefined)?.canLogin
		);
		if (!allowedToLogin) {
			return respond({ ok: false, message: authMessages.accountLocked }, 403);
		}

		// Tạo session giống /api/login
		const userDocKey = userInstance.getDocumentKey();
		const token = await signAccessToken({
			sub: userDocKey,
			username: userDoc.firstname ?? '',
			roleId: userDoc.roleId,
			statusId: userDoc.statusId,
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 1 ngày, không "remember"
		});

		event.cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 60 * 24
		});

		return respond({
			ok: true,
			message: result.message,
			data: {
				user: {
					firstname: userDoc.firstname,
					lastname: userDoc.lastname,
					roleId: userDoc.roleId,
					statusId: userDoc.statusId
				}
			}
		});
	} catch (e) {
		console.error('[POST /api/auth/webauthn/auth/verify]', e);
		return json(
			{ message: e instanceof Error ? e.message : String(e), ok: false },
			{ status: 500 }
		);
	}
};
