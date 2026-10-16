// src/routes/api/agent/profile/change-password/+server.ts
// POST { oldPassword, newPassword } — đổi mật khẩu SELF-SERVICE (session only,
// Bearer KHÔNG được đổi mật khẩu vì key không có vault cũ).
// Gọi Users.changePassword(old, new) — instance của CHÍNH actor từ session.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getActorContext } from '$lib/server/admin/api';
import { Users } from '$lib/server/db/users';
import { resolveLang, localize } from '$lib/server/i18n';

const messages = {
	expired: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' },
	invalidBody: { vi: 'Dữ liệu gửi lên không hợp lệ', en: 'Invalid request body' },
	weakPassword: {
		vi: 'Mật khẩu mới tối thiểu 8 ký tự',
		en: 'New password must be at least 8 characters'
	},
	serverError: { vi: 'Lỗi máy chủ', en: 'Server error' }
} as const;

export const POST: RequestHandler = async (event) => {
	const lang = resolveLang(event.request.headers.get('accept-language'));
	try {
		const actor = await getActorContext(event.locals);
		if (!actor) {
			return json({ ok: false, message: localize(messages.expired, lang) }, { status: 401 });
		}

		let body: { oldPassword?: string; newPassword?: string };
		try {
			body = (await event.request.json()) as { oldPassword?: string; newPassword?: string };
		} catch {
			return json({ ok: false, message: localize(messages.invalidBody, lang) }, { status: 400 });
		}
		const oldPassword = typeof body.oldPassword === 'string' ? body.oldPassword : '';
		const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
		if (!oldPassword || newPassword.length < 8) {
			return json({ ok: false, message: localize(messages.weakPassword, lang) }, { status: 400 });
		}

		const user = await Users.getById(actor.userId);
		if (!user) {
			return json({ ok: false, message: localize(messages.expired, lang) }, { status: 401 });
		}
		const result = await user.changePassword(oldPassword, newPassword);
		const status = result.success ? 200 : 400;
		return json({ ok: result.success, message: localize(result.messages, lang) }, { status });
	} catch (e) {
		console.error('[POST /api/agent/profile/change-password]', e);
		return json({ ok: false, message: localize(messages.serverError, lang) }, { status: 500 });
	}
};
