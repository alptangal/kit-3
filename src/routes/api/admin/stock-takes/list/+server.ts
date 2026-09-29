import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readAdminRequest, respondEncrypted } from '$modules/api/request-response';
import { StockTakeService } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  const { actor, payload } = await readAdminRequest(event, ['stock_takes:read']);
  if (!actor) return json({ success: false, messages: payload });

  const result = await StockTakeService.listStockTakes(actor, {
    status: payload.status,
    page: payload.page,
    pageSize: payload.pageSize
  });

  return respondEncrypted(event, result);
};
