// src/routes/api/auth/refresh/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { findRefreshToken, rotateRefreshToken, revokeRefreshToken, buildSessionFromUserId } from '$lib/server/db';
import { getClientIp } from '$lib/server/rate-limit';
import { verifyDpopProofNoBinding } from '$lib/server/dpop';
import { signAccessToken } from '$lib/server/jwt';
import { dev } from '$app/environment';

export const POST: RequestHandler = async (event) => {
	const { request, url, cookies } = event;
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
	if (!stored.success || !stored.data) {
		// Token không tồn tại / đã bị dùng rồi (đã rotate) / đã revoke — có thể là replay
		// → xoá luôn cookie phía client (cả path cũ /api/auth/refresh để dọn cookie phiên bản trước)
		cookies.delete('refreshToken', { path: '/' });
		cookies.delete('refreshToken', { path: '/api/auth/refresh' });
		return json({ error: 'Invalid refresh token' }, { status: 401 });
	}
	const storedToken = stored.data;

	const now = Math.floor(Date.now() / 1000);
	if (new Date(storedToken.expiresAt).getTime() / 1000 < now) {
		await revokeRefreshToken(refreshTokenValue);
		cookies.delete('refreshToken', { path: '/' });
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
	if (jkt !== storedToken.jkt) {
		// Revoke NGAY để chặn cả 2 phía (kẻ tấn công lẫn user gốc) — buộc login lại
		await revokeRefreshToken(refreshTokenValue);
		cookies.delete('refreshToken', { path: '/' });
		cookies.delete('refreshToken', { path: '/api/auth/refresh' });
		return json({ error: 'Key mismatch — token has been revoked' }, { status: 401 });
	}

	// Hợp lệ — rotate refresh token (không tái sử dụng token cũ, giảm rủi ro nếu bị lộ)
	const newRefreshTokenValue = crypto.randomUUID() + crypto.randomUUID();
	const rotated = await rotateRefreshToken(refreshTokenValue, {
		token: newRefreshTokenValue,
		userId: storedToken.userId,
		jkt,
		expiresAt: now + 30 * 86400,
		deviceId: storedToken.deviceId ?? crypto.randomUUID(),
		ipAddress: getClientIp(request, event.getClientAddress),
		userAgent: request.headers.get('user-agent') ?? ''
	});

	if (!rotated.success) {
		// Trường hợp hiếm: 2 request refresh cùng lúc, request này thua race
		// (token cũ đã bị request kia rotate mất trước khi tới đây)
		return json({ error: 'Refresh token already used' }, { status: 401 });
	}

	const accessToken = await signAccessToken({
		sub: storedToken.userId,
		cnf: { jkt },
		iat: now,
		exp: now + 15 * 60
	});

	cookies.set('refreshToken', newRefreshTokenValue, {
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		// Path / — đồng bộ với login: hooks đọc được refreshToken ở mọi request
		// để khôi phục session SSR khi session cookie hết hạn.
		path: '/',
		maxAge: 30 * 86400
	});

	// Cấp lại session cookie (path /, 30 ngày) — phòng khi session cookie hết hạn
	// nhưng refresh token còn hạn: client gọi refresh là đủ, không cần login lại.
	try {
		const fields = await buildSessionFromUserId(storedToken.userId);
		if (fields) {
			const sessionToken = await signAccessToken({
				sub: storedToken.userId,
				username: fields.username,
				roleId: fields.roleId,
				statusId: fields.statusId,
				iat: now,
				exp: now + 30 * 86400
			});
			cookies.set('session', sessionToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: !dev,
				maxAge: 30 * 86400
			});
		}
	} catch (e) {
		// Không chặn refresh — access token vẫn đã được cấp phía trên
		console.error('[POST /api/auth/refresh] reissue session failed:', e);
	}

	return json({ accessToken });
};
