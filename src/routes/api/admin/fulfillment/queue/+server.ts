// src/routes/api/admin/fulfillment/queue/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { FulfillmentService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			branchId?: string;
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

		const result = await FulfillmentService.listFulfillmentQueue(actor, {
			branchId: read.data.branchId,
			page: read.data.page,
			pageSize: read.data.pageSize
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: {
				vi: 'Lấy hàng chờ xử lý đơn thành công',
				en: 'Fulfillment queue fetched successfully'
			},
			data: {
				items: result.data.items,
				total: result.data.total,
				page: result.data.page,
				pageSize: result.data.pageSize
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/fulfillment/queue]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
