// src/routes/(authorized)/admin/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { PermissionChecker } from '$modules/rbac/permission-checker';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// (authorized)/+layout.server.ts đã redirect nếu chưa đăng nhập — double-check
	// ở đây cho defense in depth (layout cha chạy trước nhưng giữ an toàn khi tách file).
	if (!locals.user) {
		const redirectUrl = encodeURIComponent(url.pathname + url.search);
		throw redirect(303, `/login?redirect=${redirectUrl}`);
	}

	// Chặn cả trang admin với người không có quyền quản trị user —
	// toàn bộ admin UI chỉ chứa các thao tác gated bởi 'users:manage'.
	const roleName = locals.user.roleName;
	const allowed = roleName ? await PermissionChecker.can(roleName, 'users:manage', {}) : false;
	if (!allowed) {
		// 303 redirect về trang chủ thay vì trả 403 (không để lộ sự tồn tại của trang)
		throw redirect(303, '/');
	}

	return {
		user: locals.user
	};
};
