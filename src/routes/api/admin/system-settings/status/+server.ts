// src/routes/api/admin/system-settings/status/+server.ts
// POST — health status tổng hợp: uptime, timestamp, node version + platform,
// memory (heapUsed/heapTotal), đếm audit_logs 7 ngày qua, db connectivity check.
// Giữ đồng bộ pattern 2 route trên: readAdminRequest + getActorContext + respondEncrypted.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { SystemSettingsService } from '$lib/server/db/system-settings';
import { cbData } from '$modules/couchbase/clients';
import { cb_bucketName, cb_scopeName } from '$env/static/private';

const systemKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`system\``;

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<Record<string, unknown>>(event);
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

		// (a) uptime từ process.uptime() · (b) timestamp hiện tại
		// (c) node version + platform · (d) memory heapUsed/heapTotal
		const mem = process.memoryUsage();

		// (f) db connectivity check — query đơn giản trên collection 'system'
		let dbOk = false;
		try {
			const dbRes = await cbSystemQuery();
			dbOk = dbRes;
		} catch {
			dbOk = false;
		}

		// (e) audit logs gần đây (7 ngày qua) — query collection audit_logs
		let auditLogs: Awaited<ReturnType<typeof SystemSettingsService.listRecentAuditLogs>> =
			{ success: false, messages: { vi: 'Chưa chạy', en: 'Not run' } };
		try {
			auditLogs = await SystemSettingsService.listRecentAuditLogs(actor, { days: 7, limit: 10 });
		} catch {
			// giữ auditLogs thất bại — dashboard hiện trạng thái lỗi
		}

		return respond({
			ok: true,
			message: {
				vi: 'Lấy trạng thái hệ thống thành công',
				en: 'System status fetched successfully'
			},
			data: {
				uptimeSeconds: process.uptime(),
				timestamp: new Date().toISOString(),
				nodeVersion: process.version,
				platform: process.platform,
				memory: {
					heapUsed: mem.heapUsed,
					heapTotal: mem.heapTotal
				},
				db: { ok: dbOk },
				audit: auditLogs.success
					? { ok: true, total: auditLogs.total, items: auditLogs.items }
					: { ok: false, total: 0, items: [] }
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/system-settings/status]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};

/** Query connectivity đơn giản — SELECT 1 (RAW COUNT trên keyspace 'system'). */
async function cbSystemQuery(): Promise<boolean> {
	const res = await cbData('system').document.query({
		statement: `SELECT RAW COUNT(*) FROM ${systemKeyspace}`,
		args: [],
		readonly: true
	});
	return res.ok;
}
