// src/routes/api/auth/logout/+server.ts
// POST /api/auth/logout — thu hồi refresh token + xoá cookies session/refreshToken.
// Public path (hooks) — không cần session hợp lệ để logout (idempotent: gọi khi
// không có token vẫn trả ok để client luôn dọn được state).
import { json, type RequestHandler } from '@sveltejs/kit';
import { revokeRefreshToken } from '$lib/server/db';

export const POST: RequestHandler = async ({ cookies }) => {
	const refreshTokenValue = cookies.get('refreshToken');

	if (refreshTokenValue) {
		try {
			await revokeRefreshToken(refreshTokenValue, 'logout');
		} catch (e) {
			// Revoke fail không chặn logout — cookie vẫn bị xoá, token sẽ hết hạn tự nhiên
			console.error('[POST /api/auth/logout] revoke error:', e);
		}
	}

	// Xoá cả 2 cookie — path phải khớp lúc set để browser xoá đúng
	cookies.delete('refreshToken', { path: '/api/auth/refresh' });
	cookies.delete('session', { path: '/' });

	return json({ ok: true });
};
