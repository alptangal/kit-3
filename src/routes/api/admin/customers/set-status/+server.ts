// src/routes/api/admin/customers/set-status/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { CustomerAdminService } from '$lib/server/db/customers';
import { invalidateGrantsCache } from '$modules/rbac/permission-checker';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ documentKey: string; statusId: string }>(event);
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

		const { documentKey, statusId } = read.data;
		if (!documentKey || !statusId) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu documentKey hoặc statusId',
						en: 'Missing documentKey or statusId'
					}
				},
				400
			);
		}

		const result = await CustomerAdminService.setStatus(actor, documentKey, statusId);
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		// Trạng thái ảnh hưởng khả năng đăng nhập — làm mới grants cache
		invalidateGrantsCache();

		return respond({ ok: true, message: result.messages });
	} catch (e) {
		console.error('[POST /api/admin/customers/set-status]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};