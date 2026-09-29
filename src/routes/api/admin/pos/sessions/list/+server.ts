import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readAdminRequest, respondEncrypted } from '$modules/api/request-response';
import { POSService } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  const { actor, payload } = await readAdminRequest(event, ['pos:read']);
  if (!actor) return json({ success: false, messages: payload });

  const result = await POSService.listSessions(actor, {
    status: payload.status,
    deviceId: payload.deviceId,
    page: payload.page,
    pageSize: payload.pageSize
  });

  return respondEncrypted(event, result);
};
