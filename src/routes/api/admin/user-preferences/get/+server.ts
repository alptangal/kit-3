// src/routes/api/admin/user-preferences/get/+server.ts
// POST — đọc per-user preferences của CHÍNH MÌNH: readAdminRequest → getActorContext →
// UserPreferencesService.get(userId từ session) → respondEncrypted.
// Trả { ok, message, data: { preferences } }.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { UserPreferencesService } from '$lib/server/db/user-preferences';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<Record<string, unknown>>(event);
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

		const preferences = await UserPreferencesService.get(actor.userId);
		return respond({
			ok: true,
			message: {
				vi: 'Lấy tùy chọn người dùng thành công',
				en: 'User preferences fetched successfully'
			},
			data: { preferences }
		});
	} catch (e) {
		console.error('[POST /api/admin/user-preferences/get]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
