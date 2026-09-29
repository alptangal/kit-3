import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { StockTakesService } from '$lib/server/db/stock-takes';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			stockTakeId: string;
			items: Array<{
				variantId: string;
				lotId: string;
				systemQuantity: number;
				countedQuantity: number;
			}>;
		}>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64, data } = read;

		const actor = await getActorContext(locals);
		if (!actor) {
			return json({ ok: false, message: 'Unauthorized' }, { status: 401 });
		}

		const result = await StockTakesService.addCountedItems(actor, {
			stockTakeId: data.stockTakeId,
			items: data.items
		});

		return respondEncrypted(publicKeyB64, result, lang);
	} catch (err) {
		console.error('Error adding stock take items:', err);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};
