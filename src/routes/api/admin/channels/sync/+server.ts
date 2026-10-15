// src/routes/api/admin/channels/sync/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { ChannelService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ documentKey: string }>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		if (!read.data.documentKey) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu documentKey', en: 'Missing documentKey' } },
				400
			);
		}

		const result = await ChannelService.syncOrders(actor, read.data.documentKey);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}
		return respond({
			ok: true,
			message: {
				vi: `Đồng bộ xong: ${result.data?.inserted ?? 0} đơn mới, ${result.data?.skipped ?? 0} trùng`,
				en: `Sync done: ${result.data?.inserted ?? 0} new, ${result.data?.skipped ?? 0} duplicates`
			},
			data: result.data
		});
	} catch (e) {
		console.error('[POST /api/admin/channels/sync]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
