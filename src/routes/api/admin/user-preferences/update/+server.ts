// src/routes/api/admin/user-preferences/update/+server.ts
// POST — ghi per-user preferences của CHÍNH MÌNH: readAdminRequest → getActorContext →
// UserPreferencesService.patch(userId từ session, patch từ body) → respondEncrypted.
// userId LUÔN lấy từ session — patch trong body không chứa userId (không ghi chéo user).
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import {
	UserPreferencesService,
	type UserPreferencesPatch
} from '$lib/server/db/user-preferences';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ patch?: UserPreferencesPatch }>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64, data } = read;

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

		const result = await UserPreferencesService.patch(actor.userId, data.patch ?? {});
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, 400);
		}

		return respond({
			ok: true,
			message: result.messages,
			data: { preferences: await UserPreferencesService.get(actor.userId) }
		});
	} catch (e) {
		console.error('[POST /api/admin/user-preferences/update]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
