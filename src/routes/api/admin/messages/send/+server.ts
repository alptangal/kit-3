// src/routes/api/admin/messages/send/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { MessageService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			threadId?: string;
			recipientIds: string[];
			subject?: string;
			body: string;
			attachments?: { name: string; url: string; size: number }[];
		}>(event);
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

		const result = await MessageService.send(actor, {
			threadId: read.data.threadId,
			recipientIds: read.data.recipientIds,
			subject: read.data.subject,
			body: read.data.body,
			attachments: read.data.attachments
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Đã gửi tin nhắn', en: 'Message sent' },
			data: result.data
		});
	} catch (e) {
		console.error('[POST /api/admin/messages/send]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
