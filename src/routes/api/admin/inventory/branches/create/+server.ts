// src/routes/api/admin/inventory/branches/create/+server.ts
// B49 (chain B): tạo chi nhánh mới từ quick-create trong PO form modal.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { InventoryService } from '$lib/server/db/inventory';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	let secureResponder:
		| ((payload: Parameters<typeof respondEncrypted>[1], status?: number) => Promise<Response>)
		| undefined;
	try {
		const read = await readAdminRequest<{ name?: string }>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);
		secureResponder = respond;

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

		const name = (read.data.name ?? '').trim();
		if (!name) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu tên chi nhánh',
						en: 'Missing branch name'
					}
				},
				400
			);
		}

		const result = await InventoryService.createBranch(actor, { name });

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Tạo chi nhánh thành công', en: 'Branch created successfully' },
			data: result.branch
		});
	} catch (e) {
		console.error('[POST /api/admin/inventory/branches/create]', e);
		if (secureResponder) {
			return secureResponder(
				{ ok: false, message: { vi: 'Tạo chi nhánh thất bại. Vui lòng thử lại.', en: 'Failed to create branch. Please try again.' } },
				500
			);
		}
		return json({ message: { vi: 'Tạo chi nhánh thất bại. Vui lòng thử lại.', en: 'Failed to create branch. Please try again.' }, ok: false }, { status: 500 });
	}
};
