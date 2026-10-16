// src/routes/api/admin/activity/query/+server.ts
// POST { type: 'summary' | 'per-user' | 'top-pages' | 'top-errors', date?, from?, to?, limit? }
// 1 route duy nhất cho toàn bộ thống kê lịch sử truy cập — switch theo type gọi AccessLogService.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { AccessLogService } from '$lib/server/db/activity-logs';

const VALID_TYPES = ['summary', 'per-user', 'top-pages', 'top-errors'] as const;
type ActivityType = (typeof VALID_TYPES)[number];

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			type: string;
			date?: string;
			from?: string;
			to?: string;
			limit?: number;
			orderBy?: 'hits' | 'duration';
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

		const { type, ...params } = read.data;
		if (!VALID_TYPES.includes(type as ActivityType)) {
			return respond({
				ok: false,
				message: {
					vi: `Loại thống kê không hợp lệ — hợp lệ: ${VALID_TYPES.join(', ')}`,
					en: `Invalid activity type — valid: ${VALID_TYPES.join(', ')}`
				}
			});
		}

		let result:
			| Awaited<ReturnType<typeof AccessLogService.todaySummary>>
			| Awaited<ReturnType<typeof AccessLogService.perUser>>
			| Awaited<ReturnType<typeof AccessLogService.topPages>>
			| Awaited<ReturnType<typeof AccessLogService.topErrors>>;

		switch (type as ActivityType) {
			case 'summary':
				result = await AccessLogService.todaySummary(actor, { date: params.date });
				break;
			case 'per-user':
				result = await AccessLogService.perUser(actor, { date: params.date });
				break;
			case 'top-pages':
				result = await AccessLogService.topPages(actor, {
					from: params.from,
					to: params.to,
					limit: params.limit,
					orderBy: params.orderBy
				});
				break;
			case 'top-errors':
				result = await AccessLogService.topErrors(actor, {
					from: params.from,
					to: params.to,
					limit: params.limit
				});
				break;
			default:
				return respond({ ok: false, message: { vi: 'Loại thống kê không hợp lệ', en: 'Invalid activity type' } });
		}

		if (!result.success) {
			return respond(
				{ ok: false, message: result.messages ?? { vi: 'Lỗi truy vấn', en: 'Query failed' } },
				statusForServiceFailure(result.messages as never)
			);
		}

		return respond({ ok: true, data: result });
	} catch (e) {
		console.error('[POST /api/admin/activity/query]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
