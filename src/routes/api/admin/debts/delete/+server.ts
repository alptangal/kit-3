// src/routes/api/admin/debts/delete/+server.ts
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
		const read = await readAdminRequest<{ id: string }>(event);
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

		if (!read.data.id) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu ID khoản nợ',
						en: 'Missing debt id'
					}
				},
				400
			);
		}

		const result = await DebtService.delete(actor, read.data.id);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Xóa khoản nợ thành công', en: 'Debt deleted successfully' }
		});
	} catch (e) {
		console.error('[POST /api/admin/debts/delete]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
