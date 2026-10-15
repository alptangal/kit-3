// src/routes/api/admin/channels/orders-import/+server.ts
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

		const result = await ChannelService.importChannelOrder(actor, read.data.documentKey);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}
		return respond({
			ok: true,
			message: {
				vi: `Đã nhập đơn ${result.data?.orderCode ?? ''} vào hệ thống`,
				en: `Imported as ${result.data?.orderCode ?? ''}`
			},
			data: result.data
		});
	} catch (e) {
		console.error('[POST /api/admin/channels/orders-import]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
