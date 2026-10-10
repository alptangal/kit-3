// src/routes/api/admin/system-settings/update/+server.ts
// POST — cập nhật settings: readAdminRequest → getActorContext →
// SystemSettingsService.update(patch) → respondEncrypted. 403 nếu không phải owner.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import {
	SystemSettingsService,
	systemSettingsMessages,
	type SystemSettingsPatch
} from '$lib/server/db/system-settings';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ patch?: SystemSettingsPatch }>(event);
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

		const patch = read.data.patch;
		if (!patch || typeof patch !== 'object') {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu dữ liệu cấu hình (patch)',
						en: 'Missing settings patch'
					}
				},
				400
			);
		}

		const result = await SystemSettingsService.update(actor, patch);
		if (!result.success) {
			// permissionDenied (chỉ owner được sửa) → 403; còn lại 400
			const denied = result.messages === systemSettingsMessages.permissionDenied;
			return respond({ ok: false, message: result.messages }, denied ? 403 : 400);
		}

		return respond({ ok: true, message: result.messages });
	} catch (e) {
		console.error('[POST /api/admin/system-settings/update]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
