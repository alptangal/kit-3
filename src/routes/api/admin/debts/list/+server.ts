// src/routes/api/admin/debts/list/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { DebtService } from '$lib/server/db/debts';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			type?: string;
			partyType?: string;
			status?: string;
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

		const result = await DebtService.list(actor, {
			type: read.data.type,
			partyType: read.data.partyType,
			status: read.data.status,
			branchId: read.data.branchId,
			page: read.data.page,
			pageSize: read.data.pageSize
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Lấy danh sách công nợ thành công', en: 'Debt list fetched successfully' },
			data: {
				items: result.items,
				total: result.total,
				page: result.page,
				pageSize: result.pageSize
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/debts/list]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
