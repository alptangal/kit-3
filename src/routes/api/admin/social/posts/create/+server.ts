// src/routes/api/admin/social/posts/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SocialPostService } from '$lib/server/db';
import type { SocialPlatform } from '$lib/server/db/social';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			platform: SocialPlatform;
			content: string;
			mediaUrls?: string[];
			campaignId?: string;
			scheduledAt?: string;
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

		if (!read.data.platform || !read.data.content) {
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

		const result = await SocialPostService.createPost(actor, {
			platform: read.data.platform,
			content: read.data.content,
			mediaUrls: read.data.mediaUrls,
			campaignId: read.data.campaignId,
			scheduledAt: read.data.scheduledAt
		});

		if (!result.success) {
			return respond(
				{ ok: false, message: result.messages },
				statusForServiceFailure(result.messages)
			);
		}

		return respond({
			ok: true,
			message: { vi: 'Đã tạo bài đăng', en: 'Post created successfully' },
			data: result.data
		});
	} catch (e) {
		console.error('[POST /api/admin/social/posts/create]', e);
		return json(
			{ message: e instanceof Error ? e.message : String(e), ok: false },
			{ status: 500 }
		);
	}
};
