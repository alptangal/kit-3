// $lib/server/db/activity-logs.ts
// Lịch sử truy cập user + thời gian sử dụng ứng dụng — phục vụ thống kê
// tối ưu page/router sau này.
//
// Kiến trúc:
// - Collection 'access_logs' (schema.ts): { userId, path, method, status, durationMs, at, userAgent?, ip? }.
// - Ghi: hooks.server.ts gọi AccessLogService.record() SAU handle() — fire-and-forget
//   (dynamic import + catch im lặng, không bao giờ block response).
// - Cleanup: ~1% request trigger dọn log >30 ngày (hooks gọi cleanupOld()).
// - Đọc: API /api/admin/activity/* với permission 'activity:read'
//   (owner: all, manager: own_branch — chi tiết userBranchId → lọc userId của user cùng chi nhánh).
import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { adminMessages } from './users';
import type { AccessLog } from '$modules/schema';
import type { ActorContext } from './suppliers';

const cbAccessLogs = cbData('access_logs');
const cbUsers = cbData('users');

const accessLogsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`access_logs\``;
const usersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`users\``;

/** Giữ log tối đa 30 ngày */
const RETENTION_DAYS = 30;

const activityMessages = {
	permissionDenied: adminMessages.permissionDenied,
	queryFailed: {
		vi: 'Truy vấn lịch sử truy cập thất bại',
		en: 'Failed to query access history'
	} as TranslateContent,
	invalidRange: {
		vi: 'Khoảng thời gian không hợp lệ',
		en: 'Invalid date range'
	} as TranslateContent
};

function isValidDateStr(v: unknown): boolean {
	return typeof v === 'string' && v.length > 0 && !Number.isNaN(Date.parse(v));
}


/**
 * BẪY N1QL Capella: 'at' và 'path' là RESERVED WORD — dùng trần trong SELECT/WHERE/
 * GROUP BY/ORDER BY là syntax error (code 3000) dù backtick xung quanh tên index,
 * alias `path AS path` cũng fail (chỉ alias khác được). Mọi tham chiếu field này
 * PHẢI bọc backtick: `at`, `path`.
 */
const qf = (field: string): string => (field === 'at' || field === 'path' ? `\`${field}\`` : field);

function buildRangeFilter(
	conditions: string[],
	args: (string | number)[],
	field: string,
	from?: string,
	to?: string
): void {
	const f = qf(field);
	if (from) {
		conditions.push(`${f} >= $${args.length + 1}`);
		args.push(from);
	}
	if (to) {
		// to là ngày cuối (YYYY-MM-DD) → lấy trọn trong ngày (qua 'toT23:59:59' do caller chuẩn hoá)
		conditions.push(`${f} <= $${args.length + 1}`);
		args.push(to);
	}
}

export interface AccessLogEntry {
	userId: string;
	path: string;
	method: string;
	status: number;
	durationMs: number;
	at: string;
	userAgent?: string | null;
	ip?: string | null;
}

export class AccessLogService {
	/**
	 * Ghi 1 entry access log — được hooks.server.ts gọi fire-and-forget.
	 * KHÔNG ném lỗi (catch mọi thứ bên trong) — log thất bại không được phép
	 * ảnh hưởng response.
	 */
	static async record(entry: AccessLogEntry): Promise<void> {
		try {
			const now = entry.at ?? new Date().toISOString();
			const docKey = `alog_${Buffer.from(`${entry.userId}|${now}`).toString('base64url')}`;
			const doc: AccessLog = {
				userId: entry.userId,
				path: entry.path,
				method: entry.method,
				status: entry.status,
				durationMs: entry.durationMs,
				at: now,
				userAgent: entry.userAgent ?? null,
				ip: entry.ip ?? null
			};
			await cbAccessLogs.document.create({ documentKey: docKey, content: doc });
		} catch {
			// im lặng — access log không bao giờ được phá response
		}
	}

	/** Dọn log >30 ngày — hooks gọi ngẫu nhiên ~1% request. Trả về số doc đã xoá (best-effort). */
	static async cleanupOld(): Promise<number> {
		try {
			const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
			const res = await cbAccessLogs.document.query({
				statement: `DELETE FROM ${accessLogsKeyspace} WHERE ${qf('at')} < $1`,
				args: [cutoff],
				readonly: false
			});
			if (!res.ok) return 0;
			return 0; // Data API không trả số dòng xoá đáng tin cậy — chỉ cần ok
		} catch {
			return 0;
		}
	}

	/** Bảo đảm actor có quyền activity:read; null = pass. */
	private static async requirePermission(
		actor: ActorContext,
		targetBranchId?: string | null
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, 'activity:read', {
			branchId: actor.branchId,
			targetBranchId,
			actorUserId: actor.userId
		});
		if (!allowed) return { success: false, messages: activityMessages.permissionDenied };
		return null;
	}

	/** Scope 'own_branch' → chỉ xem user thuộc cùng chi nhánh (userId set). */
	private static async allowedUserIds(
		actor: ActorContext
	): Promise<string[] | null> {
		if (actor.roleName === 'owner') return null; // all
		const scope = await PermissionChecker.getScope(actor.roleName, 'activity:read');
		if (scope !== 'own_branch') return null;
		if (!actor.branchId) return []; // không branch → không thấy gì
		const res = await cbUsers.document.query({
			statement: `SELECT META().id AS userId FROM ${usersKeyspace} WHERE userBranchId = $1`,
			args: [actor.branchId],
			readonly: true
		});
		if (!res.ok) return [];
		return ((res.data?.results ?? []) as { userId: string }[]).map(r => r.userId);
	}

	/** userId list → condition IN (không dùng trực tiếp — visibility qua applyVisibility) */
	private static userIdCondition(conditions: string[], args: (string | number)[], allowed: string[] | null): void {
		if (allowed === null) return;
		if (allowed.length === 0) {
			conditions.push("userId = 'SYSTEM_NONE'");
			return;
		}
		conditions.push(`userId IN [${allowed.map(u => `'${u.replace(/'/g, "''")}'`).join(', ')}]`);
	}

	private static applyVisibility(
		conditions: string[],
		args: (string | number)[],
		allowed: string[] | null
	): boolean {
		if (allowed === null) return true;
		if (allowed.length === 0) return false; // không thấy gì
		conditions.push(`userId IN [${allowed.map(u => `'${u.replace(/'/g, "''")}'`).join(', ')}]`);
		return true;
	}

	/**
	 * Tóm tắt 1 ngày (mặc định hôm nay): tổng request, số user active, trung bình duration.
	 */
	static async todaySummary(
		actor: ActorContext,
		options: { date?: string } = {}
	): Promise<
		| { success: true; totalRequests: number; activeUsers: number; avgDurationMs: number; errorCount: number }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor);
		if (denied) return denied;
		const date = options.date;
		if (date && !isValidDateStr(date)) return { success: false, messages: activityMessages.invalidRange };

		// Day range: [date 00:00, date+1 00:00)
		const dayStart = date ? `${date}T00:00:00.000Z` : new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
		const dayEnd = new Date(new Date(dayStart).getTime() + 86400_000).toISOString();

		const conditions: string[] = [`${qf('at')} >= $1`, `${qf('at')} < $2`];
		const args: (string | number)[] = [dayStart, dayEnd];

		const allowed = await this.allowedUserIds(actor);
		if (!this.applyVisibility(conditions, args, allowed)) {
			return { success: true, totalRequests: 0, activeUsers: 0, avgDurationMs: 0, errorCount: 0 };
		}

		const res = await cbAccessLogs.document.query({
			statement: `
				SELECT COUNT(*) AS total,
				       COUNT(DISTINCT userId) AS activeUsers,
				       AVG(durationMs) AS avgDuration,
				       SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errorCount
				FROM ${accessLogsKeyspace}
				WHERE ${conditions.join(' AND ')}
			`.trim(),
			args: [...args, ...(args.length ? [] : [])],
			readonly: true
		});
		if (!res.ok) return { success: false, messages: activityMessages.queryFailed };
		const row = (res.data?.results ?? [])[0] ?? {};
		return {
			success: true,
			totalRequests: Number(row.total ?? 0),
			activeUsers: Number(row.activeUsers ?? 0),
			avgDurationMs: Math.round(Number(row.avgDuration ?? 0)),
			errorCount: Number(row.errorCount ?? 0)
		};
	}

	/**
	 * Thống kê theo user trong 1 ngày (mặc định hôm nay): tổng request + span first→last.
	 */
	static async perUser(
		actor: ActorContext,
		options: { date?: string } = {}
	): Promise<
		| { success: true; rows: { userId: string; username?: string; totalRequests: number; firstAt: string; lastAt: string; spanMs: number; avgDurationMs: number }[] }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor);
		if (denied) return denied;
		const date = options.date;
		if (date && !isValidDateStr(date)) return { success: false, messages: activityMessages.invalidRange };

		const dayStart = (date ?? new Date().toISOString().slice(0, 10)) + 'T00:00:00.000Z';
		const dayEnd = new Date(new Date(dayStart).getTime() + 86400_000).toISOString();

		const conditions: string[] = [`${qf('at')} >= $1`, `${qf('at')} < $2`];
		const args: (string | number)[] = [dayStart, dayEnd];
		const allowed = await this.allowedUserIds(actor);
		if (!this.applyVisibility(conditions, args, allowed)) {
			return { success: true, rows: [] };
		}

		const res = await cbAccessLogs.document.query({
			statement: `
				SELECT userId,
				       COUNT(*) AS totalRequests,
				       MIN(${qf('at')}) AS firstAt,
				       MAX(${qf('at')}) AS lastAt,
				       AVG(durationMs) AS avgDuration
				FROM ${accessLogsKeyspace}
				WHERE ${conditions.join(' AND ')}
				GROUP BY userId
				ORDER BY totalRequests DESC
				LIMIT 100
			`.trim(),
			args,
			readonly: true
		});
		if (!res.ok) return { success: false, messages: activityMessages.queryFailed };
		const rows = (res.data?.results ?? []) as {
			userId: string; totalRequests: number; firstAt: string; lastAt: string; avgDuration: number;
		}[];

		// Gắn username
		const userIds = [...new Set(rows.map(r => r.userId))];
		const userMap = await this.usernamesFor(userIds);
		return {
			success: true,
			rows: rows.map(r => ({
				userId: r.userId,
				username: userMap.get(r.userId),
				totalRequests: Number(r.totalRequests ?? 0),
				firstAt: r.firstAt,
				lastAt: r.lastAt,
				spanMs: Math.max(0, new Date(r.lastAt).getTime() - new Date(r.firstAt).getTime()),
				avgDurationMs: Math.round(Number(r.avgDuration ?? 0))
			}))
		};
	}

	/**
	 * Top pages theo lượt truy cập (từ date→to, mặc định hôm nay): path + lượt + avg duration.
	 */
	static async topPages(
		actor: ActorContext,
		options: { from?: string; to?: string; limit?: number; orderBy?: 'hits' | 'duration' } = {}
	): Promise<
		| { success: true; rows: { path: string; hits: number; avgDurationMs: number; p95DurationMs: number }[] }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor);
		if (denied) return denied;
		if ((options.from && !isValidDateStr(options.from)) || (options.to && !isValidDateStr(options.to))) {
			return { success: false, messages: activityMessages.invalidRange };
		}
		const orderBy = options.orderBy === 'duration' ? 'duration' : 'hits';
		const limit = Math.min(50, Math.max(1, options.limit ?? 10));

		const conditions: string[] = [];
		const args: (string | number)[] = [];
		buildRangeFilter(conditions, args, 'at', options.from, options.to);
		const allowed = await this.allowedUserIds(actor);
		if (!this.applyVisibility(conditions, args, allowed)) return { success: true, rows: [] };
		const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		// Lấy path + duration rồi aggregate ở Node (N1QL AVG + percentile khó kiểm soát qua Data API)
		const res = await cbAccessLogs.document.query({
			statement: `
				SELECT ${qf('path')} AS p, durationMs
				FROM ${accessLogsKeyspace}
				${where}
				LIMIT 5000
			`.trim(),
			args,
			readonly: true
		});
		if (!res.ok) return { success: false, messages: activityMessages.queryFailed };
		const rows = (res.data?.results ?? []) as { p: string; durationMs: number }[];

		const byPath = new Map<string, number[]>();
		for (const r of rows) {
			const arr = byPath.get(r.p) ?? [];
			arr.push(Number(r.durationMs ?? 0));
			byPath.set(r.p, arr);
		}
		const aggregated = [...byPath.entries()].map(([p, durations]) => {
			const sorted = [...durations].sort((a, b) => a - b);
			const avg = durations.reduce((s, d) => s + d, 0) / (durations.length || 1);
			const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
			return { path: p, hits: durations.length, avgDurationMs: Math.round(avg), p95DurationMs: p95 };
		});
		aggregated.sort((a, b) =>
			orderBy === 'duration' ? b.avgDurationMs - a.avgDurationMs : b.hits - a.hits
		);
		return { success: true, rows: aggregated.slice(0, limit) };
	}

	/**
	 * Top lỗi 4xx/5xx (từ date→to, mặc định hôm nay).
	 */
	static async topErrors(
		actor: ActorContext,
		options: { from?: string; to?: string; limit?: number } = {}
	): Promise<
		| { success: true; rows: { status: number; path: string; hits: number; lastAt: string }[] }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor);
		if (denied) return denied;
		if ((options.from && !isValidDateStr(options.from)) || (options.to && !isValidDateStr(options.to))) {
			return { success: false, messages: activityMessages.invalidRange };
		}
		const limit = Math.min(50, Math.max(1, options.limit ?? 10));

		const conditions: string[] = ['status >= 400'];
		const args: (string | number)[] = [];
		buildRangeFilter(conditions, args, 'at', options.from, options.to);
		const allowed = await this.allowedUserIds(actor);
		if (!this.applyVisibility(conditions, args, allowed)) return { success: true, rows: [] };
		const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		const res = await cbAccessLogs.document.query({
			statement: `
				SELECT status, ${qf('path')} AS p, COUNT(*) AS hits, MAX(${qf('at')}) AS lastAt
				FROM ${accessLogsKeyspace}
				${where}
				GROUP BY status, ${qf('path')}
				ORDER BY hits DESC
				LIMIT $${args.length + 1}
			`.trim(),
			args: [...args, limit],
			readonly: true
		});
		if (!res.ok) return { success: false, messages: activityMessages.queryFailed };
		const rows = (res.data?.results ?? []) as { status: number; p: string; hits: number; lastAt: string }[];
		// p → path (N1QL reserved word 'path' không thể dùng làm alias — đã đổi alias p)
		return { success: true, rows: rows.map(r => ({ status: r.status, path: r.p, hits: r.hits, lastAt: r.lastAt })) };
	}

	/**
	 * Danh sách entry chi tiết (dùng cho probe + debug): filter userId/path, from/to, phân trang.
	 */
	static async listEntries(
		actor: ActorContext,
		options: { userId?: string; path?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}
	): Promise<
		| { success: true; rows: (AccessLog & { _id: string })[]; total: number; page: number; pageSize: number }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor);
		if (denied) return denied;
		if ((options.from && !isValidDateStr(options.from)) || (options.to && !isValidDateStr(options.to))) {
			return { success: false, messages: activityMessages.invalidRange };
		}
		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: (string | number)[] = [];
		if (options.userId) {
			conditions.push(`userId = $${args.length + 1}`);
			args.push(options.userId);
		}
		if (options.path) {
			conditions.push(`${qf('path')} = $${args.length + 1}`);
			args.push(options.path);
		}
		buildRangeFilter(conditions, args, 'at', options.from, options.to);
		const allowed = await this.allowedUserIds(actor);
		if (!this.applyVisibility(conditions, args, allowed)) {
			return { success: true, rows: [], total: 0, page, pageSize };
		}
		const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		const dataStatement = `
			SELECT l.*, META().id AS _id
			FROM ${accessLogsKeyspace} l
			${where}
			ORDER BY l.${qf('at')} DESC
			LIMIT $${args.length + 1} OFFSET $${args.length + 2}
		`.trim();
		const dataArgs = [...args, pageSize, offset];
		const countStatement = `
			SELECT RAW COUNT(*) AS total
			FROM ${accessLogsKeyspace} l
			${where}
		`.trim();

		const [dataRes, countRes] = await Promise.all([
			cbAccessLogs.document.query({ statement: dataStatement, args: dataArgs, readonly: true }),
			cbAccessLogs.document.query({ statement: countStatement, args, readonly: true })
		]);
		if (!dataRes.ok || !countRes.ok) return { success: false, messages: activityMessages.queryFailed };
		const rows = (dataRes.data?.results ?? []) as (AccessLog & { _id: string })[];
		const total = Number((countRes.data?.results ?? [])[0] ?? 0);
		return { success: true, rows, total, page, pageSize };
	}

	private static async usernamesFor(userIds: string[]): Promise<Map<string, string>> {
		const map = new Map<string, string>();
		if (userIds.length === 0) return map;
		try {
			const quoted = userIds.map(u => `'${u.replace(/'/g, "''")}'`).join(', ');
			const res = await cbUsers.document.query({
				statement: `SELECT META().id AS userId, username FROM ${usersKeyspace} WHERE META().id IN [${quoted}]`,
				args: [],
				readonly: true
			});
			if (res.ok) {
				for (const r of (res.data?.results ?? []) as { userId: string; username?: string }[]) {
					if (r.username) map.set(r.userId, r.username);
				}
			}
		} catch {
			// bỏ qua — username là enrich, không bắt buộc
		}
		return map;
	}
}

// ActorContext: import từ './suppliers' (pattern chung toàn hệ thống)

