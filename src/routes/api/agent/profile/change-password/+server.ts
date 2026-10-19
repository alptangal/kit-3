// src/routes/api/agent/profile/change-password/+server.ts
// POST { oldPassword, newPassword } — đổi mật khẩu SELF-SERVICE (session only,
// Bearer KHÔNG được đổi mật khẩu vì key không có vault cũ).
// Gọi Users.changePassword(old, new) — instance của CHÍNH actor từ session.
// fetchSecure contract: body mã hoá server-key, response mã hoá session-key.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { Users } from '$lib/server/db/users';

export const POST: RequestHandler = async (event) => {
	try {
		const read = await readAdminRequest<Record<string, unknown>>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64, data } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(event.locals);
		if (!actor) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		const oldPassword = typeof data.oldPassword === 'string' ? data.oldPassword : '';
		const newPassword = typeof data.newPassword === 'string' ? data.newPassword : '';
		if (!oldPassword || newPassword.length < 8) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Mật khẩu mới tối thiểu 8 ký tự',
						en: 'New password must be at least 8 characters'
					}
				},
				400
			);
		}

		const user = await Users.getById(actor.userId);
		if (!user) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}
		const result = await user.changePassword(oldPassword, newPassword);
		return respond({ ok: result.success, message: result.messages }, result.success ? 200 : 400);
	} catch (e) {
		console.error('[POST /api/agent/profile/change-password]', e);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};
