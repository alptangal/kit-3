// src/routes/api/admin/suppliers/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SupplierService } from '$lib/server/db/suppliers';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			name: string;
			contactPerson?: string;
			address?: string;
			status: string;
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

		if (!read.data.name) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu tên nhà cung cấp',
						en: 'Missing supplier name'
					}
				},
				400
			);
		}

		const result = await SupplierService.createSupplier(actor, {
			name: read.data.name,
			contactPerson: read.data.contactPerson,
			address: read.data.address,
			status: read.data.status
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Tạo nhà cung cấp thành công', en: 'Supplier created successfully' },
			data: result.supplier
		});
	} catch (e) {
		console.error('[POST /api/admin/suppliers/create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
