// src/routes/api/auth/refresh/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { findRefreshToken, rotateRefreshToken, revokeRefreshToken } from '$lib/server/db';
import { verifyDpopProofNoBinding } from '$lib/server/dpop';
import { signAccessToken } from '$lib/server/jwt';

export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const refreshTokenValue = cookies.get('refreshToken');
	const proof = request.headers.get('DPoP');

	if (!refreshTokenValue) {
		return json({ error: 'Missing refresh token' }, { status: 401 });
	}
	if (!proof) {
		return json(
			{ error: 'DPoP header required' },
			{
				status: 400,
				headers: { 'DPoP-Nonce': crypto.randomUUID() }
			}
		);
	}

	// Tìm refresh token trong DB
	const stored = await findRefreshToken(refreshTokenValue);
	if (!stored) {
		// Token không tồn tại — có thể đã bị dùng rồi (đã rotate) hoặc chưa từng tồn tại
		// Đây là dấu hiệu khả nghi (replay refresh token cũ) → xoá luôn cookie phía client
		cookies.delete('refreshToken', { path: '/api/auth/refresh' });
		return json({ error: 'Invalid refresh token' }, { status: 401 });
	}

	const now = Math.floor(Date.now() / 1000);
	if (stored.expiresAt < now) {
		await revokeRefreshToken(refreshTokenValue);
		cookies.delete('refreshToken', { path: '/api/auth/refresh' });
		return json({ error: 'Refresh token expired' }, { status: 401 });
	}

	// Verify DPoP proof — CHƯA có access token ở bước này nên không check 'ath'
	let jkt: string;
	try {
		const result = await verifyDpopProofNoBinding({
			proof,
			htm: 'POST',
			htu: url.origin + '/api/auth/refresh'
		});
		jkt = result.jkt;
	} catch (err) {
		return json(
			{ error: 'Invalid DPoP proof' },
			{
				status: 401,
				headers: { 'DPoP-Nonce': crypto.randomUUID() }
			}
		);
	}

	// So khớp khoá: nếu khác với khoá đã bind lúc login/refresh trước
	// → khả năng refresh token bị đánh cắp và dùng từ thiết bị khác
	if (jkt !== stored.jkt) {
		// Revoke NGAY để chặn cả 2 phía (kẻ tấn công lẫn user gốc) — buộc login lại
		await revokeRefreshToken(refreshTokenValue);
		cookies.delete('refreshToken', { path: '/api/auth/refresh' });
		return json({ error: 'Key mismatch — token has been revoked' }, { status: 401 });
	}

	// Hợp lệ — rotate refresh token (không tái sử dụng token cũ, giảm rủi ro nếu bị lộ)
	const newRefreshTokenValue = crypto.randomUUID() + crypto.randomUUID();
	const rotated = await rotateRefreshToken(refreshTokenValue, {
		token: newRefreshTokenValue,
		userId: stored.userId,
		jkt,
		expiresAt: now + 30 * 86400
	});

	if (!rotated) {
		// Trường hợp hiếm: 2 request refresh cùng lúc, request này thua race
		// (token cũ đã bị request kia rotate mất trước khi tới đây)
		return json({ error: 'Refresh token already used' }, { status: 401 });
	}

	const accessToken = await signAccessToken({
		sub: stored.userId,
		cnf: { jkt },
		iat: now,
		exp: now + 15 * 60
	});

	cookies.set('refreshToken', newRefreshTokenValue, {
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		path: '/api/auth/refresh',
		maxAge: 30 * 86400
	});

	return json({ accessToken });
};
