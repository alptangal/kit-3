// src/routes/api/admin/customers/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { CustomerAdminService } from '$lib/server/db/customers';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			firstname: string;
			midname?: string | null;
			lastname?: string | null;
			description?: string;
			email: string;
			phone?: string;
			username: string;
			password: string;
			roleId: string;
			statusId?: string;
			branchId?: string | null;
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

		// Note: CustomerAdminService doesn't have create method (customers are users with role-customer)
		// Creation goes through UserAdminService.createUser with roleId='role-customer'
		// This route is kept for API consistency but returns 405
		return respond(
			{
				ok: false,
				message: {
					vi: 'Không hỗ trợ tạo khách hàng qua API này. Hãy dùng /api/admin/users/create với roleId=role-customer',
					en: 'Customer creation not supported via this API. Use /api/admin/users/create with roleId=role-customer'
				}
			},
			405
		);
	} catch (e) {
		console.error('[POST /api/admin/customers/create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};