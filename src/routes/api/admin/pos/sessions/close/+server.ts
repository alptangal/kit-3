import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readAdminRequest, respondEncrypted } from '$modules/api/request-response';
import { POSService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
  const { actor, payload } = await readAdminRequest(event, ['pos:manage']);
  if (!actor) return json({ success: false, messages: payload });

  const result = await POSService.closeSession(actor, payload.sessionId, {
    closingBalance: payload.closingBalance,
    notes: payload.notes
  });

  return respondEncrypted(event, result);
};
