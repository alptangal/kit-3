import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readAdminRequest, respondEncrypted } from '$modules/api/request-response';
import { PricingService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
  const { actor, payload } = await readAdminRequest(event, ['promotions:manage']);
  if (!actor) return json({ success: false, messages: payload });

  const result = await PricingService.createPromotion(actor, {
    code: payload.code,
    name: payload.name,
    type: payload.type,
    value: payload.value,
    minOrderValue: payload.minOrderValue,
    maxDiscountAmount: payload.maxDiscountAmount,
    usageLimit: payload.usageLimit,
    startAt: payload.startAt,
    endAt: payload.endAt,
    status: payload.status
  });

  return respondEncrypted(event, result);
};
