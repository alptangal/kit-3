// src/routes/api/admin/channels/channels-metadata/+server.ts
// Trả về metadata các kênh (label + credential/config field defs) để UI
// SINH FORM connect động — không duplicate defs ở client.
// Chỉ chứa schema form (không có secret nào) — an toàn trả về client.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext
} from '$lib/server/admin/api';
import { channelAdapters } from '$lib/server/channels/registry';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<Record<string, never>>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		const channels = Object.values(channelAdapters).map((adapter) => ({
			channel: adapter.channel,
			label: adapter.label,
			credentialFields: adapter.credentialFields,
			configFields: adapter.configFields
		}));

		return respond({ ok: true, data: { channels } });
	} catch (e) {
		console.error('[POST /api/admin/channels/channels-metadata]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
