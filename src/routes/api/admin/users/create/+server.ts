// src/routes/api/admin/users/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { UserAdminService } from '$lib/server/db/users';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			firstname: string;
			midname?: string | null;
			lastname?: string | null;
			description?: string;
			email: string;
			phone?: string;
			username: string;
			password: string;
			roleId: string;
			statusId?: string;
			branchId?: string | null;
		}>(event);
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

		const d = read.data;
		// Validate đầu vào cơ bản — các kiểm tra sâu (role/status tồn tại, trùng
		// email/username, cấp bậc role) do UserAdminService.createUser đảm nhiệm
		if (!d.firstname || !d.email || !d.username || !d.password || !d.roleId) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu trường dữ liệu bắt buộc (tên, email, tên đăng nhập, mật khẩu, vai trò)',
						en: 'Missing required fields (name, email, username, password, role)'
					}
				},
				400
			);
		}

		const result = await UserAdminService.createUser(actor, {
			firstname: d.firstname,
			midname: d.midname,
			lastname: d.lastname,
			description: d.description,
			email: d.email,
			phone: d.phone,
			username: d.username,
			password: d.password,
			roleId: d.roleId,
			statusId: d.statusId,
			branchId: d.branchId
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond(
			{
				ok: true,
				message: result.messages,
				data: { documentKey: result.documentKey }
			},
			201
		);
	} catch (e) {
		console.error('[POST /api/admin/users/create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
