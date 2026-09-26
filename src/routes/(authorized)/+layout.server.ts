// src/routes/(authorized)/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// This layout server load runs for all routes under (authorized) group
	// The hooks.server.ts already handles authentication and sets locals.user
	// But we double-check here for defense in depth

	if (!locals.user) {
		// Store the original URL for redirect after login
		const redirectUrl = encodeURIComponent(url.pathname + url.search);
		throw redirect(303, `/login?redirect=${redirectUrl}`);
	}

	// Return user data to the layout
	return {
		user: locals.user
	};
};