// src/routes/api/health/+server.ts
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return new Response(
		JSON.stringify({
			status: 'ok',
			timestamp: new Date().toISOString(),
			uptime: process.uptime()
		}),
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		}
	);
};