// src/routes/api/admin/users/set-role/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { UserAdminService } from '$lib/server/db/users';
import { invalidateGrantsCache } from '$modules/rbac/permission-checker';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ documentKey: string; roleId: string }>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Phiên đăng nhập đã hết hạn',
						en: 'Session expired'
					}
				},
				401
			);
		}

		const { documentKey, roleId } = read.data;
		if (!documentKey || !roleId) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu documentKey hoặc roleId',
						en: 'Missing documentKey or roleId'
					}
				},
				400
			);
		}

		const result = await UserAdminService.setRole(actor, documentKey, roleId);
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		// Đổi role có thể đổi phạm vi quyền của user đó — làm mới grants cache
		// để các lần check quyền sau không dùng dữ liệu cũ.
		invalidateGrantsCache();

		return respond({ ok: true, message: result.messages });
	} catch (e) {
		console.error('[POST /api/admin/users/set-role]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
