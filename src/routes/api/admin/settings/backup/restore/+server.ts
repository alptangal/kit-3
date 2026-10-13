// src/routes/api/admin/settings/backup/restore/+server.ts
// POST — nhận JSON backup trong body (đã qua readAdminRequest mã hoá), chạy
// BackupService.restoreBackup (upsert theo _id), trả summary số docs.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { BackupService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			backup?: unknown;
			collections?: string[];
		}>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Phiên đăng nhập đã hết hạn',
						en: 'Session expired'
					}
				},
				401
			);
		}

		if (!read.data?.backup) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu dữ liệu backup trong request',
						en: 'Missing backup data in request'
					}
				},
				400
			);
		}

		const result = await BackupService.restoreBackup(actor, read.data.backup, {
			collections: read.data.collections
		});
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: {
				vi: `Khôi phục thành công ${result.summary.totalUpserted} documents`,
				en: `Restored ${result.summary.totalUpserted} documents successfully`
			},
			data: { summary: result.summary }
		});
	} catch (e) {
		console.error('[POST /api/admin/settings/backup/restore]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
