import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { PricingService } from '$lib/server/db/pricing';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			status?: string;
			page?: number;
			pageSize?: number;
		}>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64, data } = read;

		const actor = await getActorContext(locals);
		if (!actor) {
			return json({ ok: false, message: 'Unauthorized' }, { status: 401 });
		}

		const result = await PricingService.listPromotions(actor, {
			status: data.status,
			page: data.page,
			pageSize: data.pageSize
		});

		return respondEncrypted(publicKeyB64, result, lang);
	} catch (err) {
		console.error('Error listing promotions:', err);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};

