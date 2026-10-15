// src/routes/api/admin/debts/create/+server.ts
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
			type: string;
			partyId: string;
			amount: number;
			dueDate?: string | null;
			referenceType?: string | null;
			referenceId?: string | null;
			referenceCode?: string | null;
			notes?: string | null;
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

		if (!read.data.type || !read.data.partyId || !read.data.amount) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu thông tin khoản nợ (loại/khách hàng-NCC/số tiền)',
						en: 'Missing debt info (type/party/amount)'
					}
				},
				400
			);
		}

		const result = await DebtService.create(actor, {
			type: read.data.type,
			partyId: read.data.partyId,
			amount: Number(read.data.amount),
			dueDate: read.data.dueDate ?? null,
			referenceType: read.data.referenceType ?? null,
			referenceId: read.data.referenceId ?? null,
			referenceCode: read.data.referenceCode ?? null,
			notes: read.data.notes ?? null
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Tạo khoản nợ thành công', en: 'Debt created successfully' },
			data: result.debt
		});
	} catch (e) {
		console.error('[POST /api/admin/debts/create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
