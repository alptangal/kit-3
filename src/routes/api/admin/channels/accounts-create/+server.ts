// src/routes/api/admin/channels/accounts-create/+server.ts
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
		const read = await readAdminRequest<{
			channel: string;
			name: string;
			shopId?: string;
			config?: Record<string, unknown>;
			credentials?: Record<string, string>;
		}>(event);
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

		if (!read.data.channel || !read.data.name) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu thông tin bắt buộc', en: 'Missing required fields' } },
				400
			);
		}

		const result = await ChannelService.createAccount(actor, {
			channel: read.data.channel,
			name: read.data.name,
			shopId: read.data.shopId,
			config: read.data.config,
			credentials: read.data.credentials
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}
		return respond({
			ok: true,
			message: { vi: 'Đã tạo tài khoản kênh', en: 'Channel account created' },
			data: result.data
		});
	} catch (e) {
		console.error('[POST /api/admin/channels/accounts-create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
