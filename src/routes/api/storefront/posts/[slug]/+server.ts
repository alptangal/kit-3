// src/routes/api/storefront/posts/[slug]/+server.ts
// Public route — KHÔNG cần đăng nhập: trả bài viết published theo slug,
// tăng viewCount. GET thuần (không body encrypted) + rate limit.
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { applyRateLimit } from '$lib/server/rate-limit';
import { PostService } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
	const { params, url, request, getClientAddress } = event;

	try {
		const limited = await applyRateLimit(request, getClientAddress, url.pathname);
		if (limited) return limited;

		const slug = params.slug?.trim();
		if (!slug) throw error(400, 'Missing slug');

		// ?lang=en|vi — mặc định vi
		const langParam = (url.searchParams.get('lang') ?? 'vi').toLowerCase();
		const language = langParam === 'en' ? 'en' : 'vi';

		const result = await PostService.getBySlug(slug, language);
		if (!result.success) {
			return json({ ok: false, message: result.messages }, { status: 404 });
		}

		// Tăng viewCount — fire-and-forget, không chặn response
		void PostService.incrementView(String(result.data.postId)).catch(() => undefined);

		return json({ ok: true, data: result.data });
	} catch (e) {
		// error() throw từ SvelteKit — để nguyên
		if (e && typeof e === 'object' && 'status' in (e as Record<string, unknown>)) throw e;
		console.error('[GET /api/storefront/posts/[slug]]', e);
		return json({ ok: false, message: { vi: 'Lỗi máy chủ', en: 'Server error' } }, { status: 500 });
	}
};
