// src/routes/api/admin/system-settings/get/+server.ts
// POST — đọc settings toàn hệ thống: readAdminRequest → getActorContext →
// SystemSettingsService.list → respondEncrypted. Trả { ok, message, data: { settings, canEdit } }.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { SystemSettingsService } from '$lib/server/db/system-settings';

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

		const result = await SystemSettingsService.list(actor);
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, 403);
		}

		return respond({
			ok: true,
			message: {
				vi: 'Lấy cấu hình hệ thống thành công',
				en: 'System settings fetched successfully'
			},
			data: { settings: result.settings, canEdit: result.canEdit }
		});
	} catch (e) {
		console.error('[POST /api/admin/system-settings/get]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
