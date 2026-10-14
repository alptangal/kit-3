// src/routes/api/admin/transfers/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { TransferService } from '$lib/server/db/transfers';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			fromBranchId: string;
			toBranchId: string;
			items: Array<{ productId: string; quantity: number; lotId?: string }>;
			notes?: string;
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

		if (!read.data.fromBranchId || !read.data.toBranchId) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu chi nhánh gửi / nhận',
						en: 'Missing source / destination branch'
					}
				},
				400
			);
		}

		const result = await TransferService.create(actor, {
			fromBranchId: read.data.fromBranchId,
			toBranchId: read.data.toBranchId,
			items: read.data.items ?? [],
			notes: read.data.notes
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Tạo phiếu chuyển kho thành công', en: 'Transfer created successfully' },
			data: { transfer: result.transfer }
		});
	} catch (e) {
		console.error('[POST /api/admin/transfers/create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
