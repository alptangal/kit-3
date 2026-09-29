import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readAdminRequest, respondEncrypted } from '$modules/api/request-response';
import { PricingService } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  const { actor, payload } = await readAdminRequest(event, ['promotions:read']);
  if (!actor) return json({ success: false, messages: payload });

  const result = await PricingService.listPromotions(actor, {
    status: payload.status,
    page: payload.page,
    pageSize: payload.pageSize
  });

  return respondEncrypted(event, result);
};
