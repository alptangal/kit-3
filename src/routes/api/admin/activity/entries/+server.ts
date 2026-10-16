// src/routes/api/admin/activity/entries/+server.ts
// POST { userId?, path?, from?, to?, page?, pageSize? } — danh sách entry chi tiết
// (probe + debug). Permission activity:read qua AccessLogService.listEntries.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { AccessLogService } from '$lib/server/db/activity-logs';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			userId?: string;
			path?: string;
			from?: string;
			to?: string;
			page?: number;
			pageSize?: number;
		}>(event);
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

		const result = await AccessLogService.listEntries(actor, read.data);
		if (!result.success) {
			return respond(
				{ ok: false, message: result.messages ?? { vi: 'Lỗi truy vấn', en: 'Query failed' } },
				statusForServiceFailure(result.messages as never)
			);
		}

		return respond({ ok: true, data: result });
	} catch (e) {
		console.error('[POST /api/admin/activity/entries]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
