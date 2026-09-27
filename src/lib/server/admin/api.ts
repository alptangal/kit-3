// src/lib/server/admin/api.ts
//
// Helper dùng chung cho các route /api/admin/** — theo đúng pattern của
// /api/register/check: request body được client mã hoá bằng public key của server
// (giải mã bằng systemVault.privateKey), phản hồi được mã hoá trở lại bằng public key
// phiên của client, mọi message thu gọn về đúng 1 ngôn ngữ client yêu cầu.

import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { encryption } from '$modules/encryption';
import { systemVault } from '$store/initSystemVault';
import { resolveLang, localizePayload } from '$lib/server/i18n';
import { Users, adminMessages, authMessages, type ActorContext } from '$lib/server/db/users';
import { cbData } from '$modules/couchbase/clients';
import { applyRateLimit } from '$lib/server/rate-limit';
import type { LanguageCode, ServerResponse, TranslateContent } from '$interfaces/basic';

const cbRoles = cbData('name_roles');

/**
 * Đọc + giải mã request body của 1 admin API request (fetchSecure contract).
 * Trả về data đã parse, ngôn ngữ client và public key phiên của client
 * (để mã hoá phản hồi), hoặc 1 Response lỗi sẵn sàng trả client (400/503).
 */
export async function readAdminRequest<T>(event: RequestEvent): Promise<
	| { ok: false; response: Response }
	| { ok: true; data: T & { publicKeyB64?: string }; lang: LanguageCode; publicKeyB64: string }
> {
	// Ngôn ngữ client yêu cầu — thu gọn mọi message về đúng 1 ngôn ngữ này
	const lang = resolveLang(event.request.headers.get('accept-language'));

	// 0. Rate limit trước khi decrypt — tiết kiệm compute khi bị từ chối
	// (config '/api/admin' trong rate-limit.ts khớp mọi route /api/admin/** qua prefix)
	const rateLimited = await applyRateLimit(
		event.request,
		event.getClientAddress,
		event.url.pathname
	);
	if (rateLimited) return { ok: false, response: rateLimited };

	// 1. Kiểm tra systemVault đã sẵn sàng
	if (!systemVault?.privateKey || !systemVault?.publicKey || !systemVault?.indexKey) {
		return {
			ok: false,
			response: json(
				localizePayload(
					{
						ok: false,
						message: {
							vi: 'Hệ thống đang khởi tạo kho mã hoá — vui lòng thử lại sau',
							en: 'Service unavailable — system initializing'
						}
					},
					lang
				),
				{ status: 503 }
			)
		};
	}

	// 2. Giải mã request body bằng private key của server
	let jsRaw: unknown;
	try {
		jsRaw = await event.request.json();
	} catch {
		return {
			ok: false,
			response: json({ message: 'Invalid JSON body', ok: false }, { status: 400 })
		};
	}

	let decryptedText: string | undefined;
	try {
		decryptedText = await encryption.decryptWithPrivateKeyHybrid(
			systemVault.privateKey,
			jsRaw as { encryptedSessionKeyB64: string; ivB64: string; ciphertextB64: string }
		);
	} catch {
		return {
			ok: false,
			response: json({ message: 'Decryption failed', ok: false }, { status: 400 })
		};
	}
	if (!decryptedText) {
		return {
			ok: false,
			response: json({ message: 'Decryption returned empty', ok: false }, { status: 400 })
		};
	}

	// 3. Parse dữ liệu đã giải mã
	const dataDecrypted = JSON.parse(decryptedText) as T & { publicKeyB64?: string };
	if (!dataDecrypted.publicKeyB64) {
		return {
			ok: false,
			response: json(
				localizePayload(
					{
						ok: false,
						message: {
							vi: 'Thiếu khoá phiên client (public key)',
							en: 'Missing session public key'
						}
					},
					lang
				),
				{ status: 400 }
			)
		};
	}

	return { ok: true, data: dataDecrypted, lang, publicKeyB64: dataDecrypted.publicKeyB64 };
}

/**
 * Mã hoá payload phản hồi bằng public key phiên của client (đảm bảo chỉ client
 * ban đầu đọc được), thu gọn message về đúng 1 ngôn ngữ client trước khi mã hoá.
 */
export async function respondEncrypted(
	sessionPublicKeyB64: string,
	payload: ServerResponse,
	lang: LanguageCode,
	status = 200
): Promise<Response> {
	const sessionPublicKey = await encryption.importPublicKey(sessionPublicKeyB64);
	const enc = await encryption.encryptWithPublicKeyHybrid(
		sessionPublicKey,
		JSON.stringify(localizePayload(payload, lang))
	);
	return json(enc, { status });
}

/**
 * Lấy ActorContext cho PermissionChecker/UserAdminService từ session user
 * mà hooks.server.ts đã ghi vào locals.
 * Trả về null nếu session không hợp lệ (chưa đăng nhập / không tra được roleName).
 */
export async function getActorContext(locals: App.Locals): Promise<ActorContext | null> {
	const sessionUser = locals.user;
	if (!sessionUser?.userId) return null;

	let roleName = sessionUser.roleName;
	if (!roleName && sessionUser.roleId) {
		// roleName chưa có sẵn trong session (vd hooks tra name_roles thất bại tạm thời)
		// — tra trực tiếp 1 lần nữa tại đây.
		try {
			const res = await cbRoles.document.get({ documentKey: sessionUser.roleId });
			if (res.ok && res.data) {
				roleName = (res.data as { name?: string }).name ?? undefined;
			}
		} catch {
			// bỏ qua — trả null bên dưới khi vẫn không có roleName
		}
	}
	if (!roleName) return null;

	// Session cookie không chứa branchId — đọc từ document user
	// (actor cần branchId cho scope 'own_branch' của PermissionChecker).
	let branchId = sessionUser.branchId;
	if (branchId === undefined) {
		try {
			const target = await Users.getById(sessionUser.userId);
			branchId = target?.user.branchId ?? undefined;
		} catch {
			branchId = undefined;
		}
	}

	return { userId: sessionUser.userId, roleName, branchId };
}

/**
 * Map messages trả về từ UserAdminService (các hằng số TranslateContent của service)
 * sang HTTP status code phù hợp: 404 không tìm thấy, 403 thiếu quyền, 409 xung đột
 * trạng thái/trùng lặp, 503 vault chưa sẵn sàng, còn lại 400.
 * So sánh theo identity (===) với chính các hằng số service trả về — không so string.
 */
export function statusForServiceFailure(messages: TranslateContent): number {
	if (messages === adminMessages.notFound) return 404;
	if (messages === adminMessages.permissionDenied) return 403;
	if (
		messages === adminMessages.userAlreadyDeleted ||
		messages === adminMessages.userNotDeleted ||
		messages === authMessages.emailTaken ||
		messages === authMessages.usernameTaken
	) {
		return 409;
	}
	if (messages === adminMessages.vaultUninitialized) return 503;
	return 400;
}
