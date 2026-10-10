// src/routes/api/admin/customers/update/+server.ts
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
			documentKey: string;
			firstname?: string;
			midname?: string | null;
			lastname?: string | null;
			description?: string;
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

		const result = await CustomerAdminService.update(actor, read.data.documentKey, {
			firstname: read.data.firstname,
			midname: read.data.midname,
			lastname: read.data.lastname,
			description: read.data.description,
			branchId: read.data.branchId
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({ ok: true, message: result.messages });
	} catch (e) {
		console.error('[POST /api/admin/customers/update]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};