// src/routes/(storefront)/+layout.server.ts
// Storefront là công khai — user có thể chưa đăng nhập. Trả locals.user
// (undefined khi anonymous) để các trang con biết hiện trạng thái đăng nhập.
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user ?? null
	};
};
