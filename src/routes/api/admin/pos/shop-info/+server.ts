// src/routes/api/admin/pos/shop-info/+server.ts
// POS receipt info: đọc appName/currency/timezone từ system settings —
// permission-free (chỉ cần actor đăng nhập; không lộ gì nhạy cảm — tên shop
// đã hiện trên mọi trang admin rồi).
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext
} from '$lib/server/admin/api';
import { SystemSettingsService, DEFAULT_SYSTEM_SETTINGS } from '$lib/server/db/system-settings';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<Record<string, never>>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		// getPublicDefaults không trả appName → đọc thẳng doc settings; fail → default.
		let shopName = DEFAULT_SYSTEM_SETTINGS.general.appName;
		let currency = DEFAULT_SYSTEM_SETTINGS.commerce.currency;
		let timezone = DEFAULT_SYSTEM_SETTINGS.general.timezone;
		try {
			const settings = await SystemSettingsService.list(actor);
			if (settings.success) {
				shopName = settings.settings.general.appName || shopName;
				currency = settings.settings.commerce.currency || currency;
				timezone = settings.settings.general.timezone || timezone;
			}
		} catch {
			/* dùng default */
		}

		return respond({
			ok: true,
			data: { shopName, currency, timezone }
		});
	} catch (e) {
		console.error('[POST /api/admin/pos/shop-info]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
