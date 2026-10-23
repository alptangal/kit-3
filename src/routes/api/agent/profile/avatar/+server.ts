// src/routes/api/agent/profile/avatar/+server.ts
// POST { avatarUrl } — cập nhật avatar SELF-SERVICE (session only).
// URL ảnh public (HF Space host qua /api/admin/upload) nên lưu plaintext.

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

		const avatarUrl = typeof data.avatarUrl === 'string' ? data.avatarUrl.trim() : '';
		if (!avatarUrl || !/^https:\/\//.test(avatarUrl) || avatarUrl.length > 500) {
			return respond(
				{ ok: false, message: { vi: 'URL avatar không hợp lệ', en: 'Invalid avatar URL' } },
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
		user.user.avatarUrl = avatarUrl;
		const saved = await user.save();
		if (!saved.success) {
			return respond(
				{
					ok: false,
					message: { vi: 'Cập nhật avatar thất bại', en: 'Failed to update avatar' }
				},
				500
			);
		}
		return respond({ ok: true, data: { avatarUrl } });
	} catch (e) {
		console.error('[POST /api/agent/profile/avatar]', e);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};
