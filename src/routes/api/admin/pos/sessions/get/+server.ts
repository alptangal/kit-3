import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { PosSessionService } from '$lib/server/db/pos-sessions';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			sessionId: string;
		}>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64, data } = read;

		const actor = await getActorContext(locals);
		if (!actor) {
			return json({ ok: false, message: 'Unauthorized' }, { status: 401 });
		}

		const result = await PosSessionService.getSession(actor, data.sessionId);

		return respondEncrypted(publicKeyB64, result, lang);
	} catch (err) {
		console.error('Error getting POS session:', err);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};

