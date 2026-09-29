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
			code: string;
			name: string;
			type: string;
			value: number;
			minOrderValue?: number;
			maxDiscountAmount?: number;
			usageLimit?: number;
			startAt: string;
			endAt: string;
			status?: string;
		}>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64, data } = read;

		const actor = await getActorContext(locals);
		if (!actor) {
			return json({ ok: false, message: 'Unauthorized' }, { status: 401 });
		}

		const result = await PricingService.createPromotion(actor, {
			code: data.code,
			name: data.name,
			type: data.type as any,
			value: data.value,
			minOrderValue: data.minOrderValue,
			maxDiscountAmount: data.maxDiscountAmount,
			usageLimit: data.usageLimit,
			startAt: data.startAt,
			endAt: data.endAt,
			status: data.status || 'active'
		});

		return respondEncrypted(publicKeyB64, result, lang);
	} catch (err) {
		console.error('Error creating promotion:', err);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};

