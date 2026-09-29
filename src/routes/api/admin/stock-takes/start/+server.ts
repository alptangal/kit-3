import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readAdminRequest, respondEncrypted } from '$modules/api/request-response';
import { StockTakeService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
  const { actor, payload } = await readAdminRequest(event, ['stock_takes:manage']);
  if (!actor) return json({ success: false, messages: payload });

  const result = await StockTakeService.startStockTake(actor, payload.stockTakeId);

  return respondEncrypted(event, result);
};
