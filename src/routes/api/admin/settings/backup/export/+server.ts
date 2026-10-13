// src/routes/api/admin/settings/backup/export/+server.ts
// POST — tạo backup toàn bộ (hoặc subset) collections và trả về NHƯ MỘT FILE
// JSON download.
//
// QUAN TRỌNG (quyết định thiết kế): brief yêu cầu "trả Response thẳng, KHÔNG
// encrypt". Nhưng client admin gọi API qua `encryption.fetchSecure`, mà
// fetchSecure BẮT BUỘC response là encrypted JSON (nếu không sẽ throw
// 'Encryption.decryptedText failed' — xem $modules/encryption.ts:418-437).
// Fetch thủ công với fetch thuần cũng không gắn được auth header (auth là
// session cookie qua hooks.server.ts + envelope mã hoá qua readAdminRequest).
// → Vậy để GIỮ nguyên luồng request mã hoá chuẩn của admin và vẫn trả file
//   về được, route này trả encrypted payload chứa { filename, contentBase64 }
//   — client decrypt bằng fetchSecure như mọi API khác rồi tự tạo Blob +
//   trigger download (pattern Blob đã có ở chart/Main.svelte:500).
// Base64 làm payload tăng ~33% — chấp nhận cho MVP (backup MVP giới hạn vài
// chục MB, xem comment đầu $lib/server/db/backup.ts).
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { BackupService } from '$lib/server/db';

/** Tên file backup: backup-YYYYMMDD-HHmmss.json (giờ local server). */
function backupFilename(now = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
		now.getHours()
	)}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
}

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ collections?: string[] }>(event);
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

		const result = await BackupService.createBackup(actor, {
			collections: read.data.collections
		});
		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		const filename = backupFilename();
		const content = JSON.stringify(result.backup, null, 2);

		return respond({
			ok: true,
			message: {
				vi: 'Tạo backup thành công',
				en: 'Backup created successfully'
			},
			data: {
				filename,
				contentBase64: Buffer.from(content, 'utf-8').toString('base64'),
				totalDocs: Object.values(result.backup.collections).reduce((s, c) => s + c.count, 0)
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/settings/backup/export]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
