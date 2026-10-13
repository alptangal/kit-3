// src/routes/api/admin/social/posts/list/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SocialPostService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			platform?: string;
			status?: string;
			campaignId?: string;
			page?: number;
			pageSize?: number;
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

		const result = await SocialPostService.listPosts(actor, {
			platform: read.data.platform,
			status: read.data.status,
			campaignId: read.data.campaignId,
			page: read.data.page,
			pageSize: read.data.pageSize
		});

		if (!result.success) {
			return respond(
				{ ok: false, message: result.messages },
				statusForServiceFailure(result.messages)
			);
		}

		return respond({
			ok: true,
			message: {
				vi: 'Lấy danh sách bài đăng thành công',
				en: 'Social post list fetched successfully'
			},
			data: {
				items: result.items,
				total: result.total,
				page: result.page,
				pageSize: result.pageSize
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/social/posts/list]', e);
		return json(
			{ message: e instanceof Error ? e.message : String(e), ok: false },
			{ status: 500 }
		);
	}
};
