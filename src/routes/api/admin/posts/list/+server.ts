// src/routes/api/admin/posts/list/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { PostService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			status?: string;
			categoryId?: string;
			authorId?: string;
			tag?: string;
			search?: string;
			language?: string;
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

		const result = await PostService.list(actor, {
			status: read.data.status,
			categoryId: read.data.categoryId,
			authorId: read.data.authorId,
			tag: read.data.tag,
			search: read.data.search,
			language: read.data.language,
			page: read.data.page,
			pageSize: read.data.pageSize
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Tải danh sách bài viết thành công', en: 'Posts loaded successfully' },
			data: result.data
		});
	} catch (e) {
		console.error('[POST /api/admin/posts/list]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
