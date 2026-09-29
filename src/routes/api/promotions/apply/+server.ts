import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PricingService } from '$lib/server/db/pricing';

export const POST: RequestHandler = async (event) => {
	try {
		const body = await event.request.json();

		if (!body || !body.promotionCode || body.orderTotal === undefined) {
			return json({ ok: false, message: 'Invalid request' }, { status: 400 });
		}

		const result = await PricingService.applyPromotion(body.promotionCode, body.orderTotal);

		return json(result);
	} catch (err) {
		console.error('Error applying promotion:', err);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};

