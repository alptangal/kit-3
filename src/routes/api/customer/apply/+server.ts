import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readCustomerRequest, respondEncrypted } from '$modules/api/request-response';
import { PricingService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
  const { actor, payload } = await readCustomerRequest(event);
  if (!actor) return json({ success: false, messages: payload });

  const result = await PricingService.applyPromotion(payload.promotionCode, payload.orderTotal);

  return respondEncrypted(event, result);
};
