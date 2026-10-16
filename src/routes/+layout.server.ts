import type { RequestEvent } from '@sveltejs/kit';

export const load = async ({ request }: { request: RequestEvent['request'] }) => {
	return {
		userAgent: request.headers.get('user-agent')
	};
};
