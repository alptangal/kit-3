// src/routes/(authorized)/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { UserPreferencesService } from '$lib/server/db/user-preferences';
import { SystemSettingsService } from '$lib/server/db/system-settings';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// This layout server load runs for all routes under (authorized) group
	// The hooks.server.ts already handles authentication and sets locals.user
	// But we double-check here for defense in depth

	if (!locals.user?.userId) {
		// Store the original URL for redirect after login
		const redirectUrl = encodeURIComponent(url.pathname + url.search);
		throw redirect(303, `/login?redirect=${redirectUrl}`);
	}

	// Per-user preferences + system defaults (theme/language fallback) — đọc 2 document
	// server-side thay vì client fetch thêm 1 vòng mã hoá sau login. Lỗi DB → prefs rỗng,
	// client tự fallback (không chặn trang).
	const [prefs, system] = await Promise.all([
		UserPreferencesService.get(locals.user.userId),
		SystemSettingsService.getPublicDefaults()
	]);

	// Return user data + preferences to the layout
	return {
		user: locals.user,
		prefs,
		system
	};
};
