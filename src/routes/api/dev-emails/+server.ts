import { dev } from '$app/environment';
import { json, type RequestHandler } from '@sveltejs/kit';
import { getDevOutbox } from '$lib/server/email';

export const GET: RequestHandler = async () => {
	if (!dev) return json({ emails: [] }, { status: 404 });
	return json({ emails: getDevOutbox() });
};
