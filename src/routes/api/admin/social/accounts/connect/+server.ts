// src/routes/api/admin/social/accounts/connect/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SocialAccountService } from '$lib/server/db';
import type { SocialPlatform } from '$lib/server/db/social';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			platform: SocialPlatform;
			accountName: string;
			handle?: string;
			pageId?: string;
			accessToken?: string;
		}>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Phiên đăng nhập đã hết hạn',
						en: 'Session expired'
					}
				},
				401
			);
		}

		if (!read.data.platform || !read.data.accountName) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu thông tin bắt buộc',
						en: 'Missing required fields'
					}
				},
				400
			);
		}

		const result = await SocialAccountService.connectAccount(actor, {
			platform: read.data.platform,
			accountName: read.data.accountName,
			handle: read.data.handle,
			pageId: read.data.pageId,
			accessToken: read.data.accessToken
		});

		if (!result.success) {
			return respond(
				{ ok: false, message: result.messages },
				statusForServiceFailure(result.messages)
			);
		}

		return respond({
			ok: true,
			message: { vi: 'Đã kết nối tài khoản', en: 'Account connected successfully' },
			data: result.data
		});
	} catch (e) {
		console.error('[POST /api/admin/social/accounts/connect]', e);
		return json(
			{ message: e instanceof Error ? e.message : String(e), ok: false },
			{ status: 500 }
		);
	}
};
