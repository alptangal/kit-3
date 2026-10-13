import { cbData } from '$modules/couchbase/clients';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import type { ActorContext } from './users';

const cbCampaigns = cbData('campaigns');
const campaignsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`campaigns\``;

// ============================================================
// Chiến dịch marketing (Campaign Marketing)
// ============================================================

export interface CampaignSegmentRule {
	field: string; // vd: totalSpent, lastOrderAt, orderCount
	operator: string; // vd: >, <, >=, <=, ==, !=
	value: string | number;
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
export type CampaignType = 'promotion' | 'email' | 'push' | 'social' | 'discount_code';

export interface CampaignDocument {
	campaignId: string;
	name: string;
	description?: string;
	type: CampaignType;
	status: CampaignStatus;
	budget?: number;
	spent?: number;
	promotionIds: string[];
	segmentRules?: CampaignSegmentRule[];
	targetCount?: number;
	reachedCount?: number;
	startAt?: string;
	endAt?: string;
	createdAt: string;
	updatedAt: string;
}

const CAMPAIGN_ADMIN_SAFE_FIELDS = [
	'campaignId',
	'name',
	'description',
	'type',
	'status',
	'budget',
	'spent',
	'promotionIds',
	'segmentRules',
	'targetCount',
	'reachedCount',
	'startAt',
	'endAt',
	'createdAt',
	'updatedAt'
] as const;

export function sanitizeCampaignForAdmin(doc: Record<string, unknown>) {
	const result: Record<string, unknown> = { _id: doc._id };
	for (const key of CAMPAIGN_ADMIN_SAFE_FIELDS) {
		if (doc[key] !== undefined) result[key] = doc[key];
	}
	return result;
}

export interface CampaignListFilters {
	type?: string;
	status?: string;
	from?: string; // startAt >= from
	to?: string; // endAt <= to
	page?: number;
	pageSize?: number;
}

interface ListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

const adminMessages = {
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện hành động này',
		en: 'You do not have permission to perform this action'
	},
	notFound: { vi: 'Không tìm thấy chiến dịch', en: 'Campaign not found' },
	queryFailed: {
		vi: 'Không thể truy vấn danh sách chiến dịch',
		en: 'Failed to query campaigns'
	},
	createFailed: { vi: 'Không thể tạo chiến dịch', en: 'Failed to create campaign' },
	updateFailed: { vi: 'Không thể cập nhật chiến dịch', en: 'Failed to update campaign' },
	deleteFailed: { vi: 'Không thể xóa chiến dịch', en: 'Failed to delete campaign' },
	invalidStatusTransition: {
		vi: 'Chuyển trạng thái không hợp lệ',
		en: 'Invalid status transition'
	},
	promotionNotFound: {
		vi: 'Một hoặc nhiều khuyến mãi không tồn tại',
		en: 'One or more promotions do not exist'
	},
	statsFailed: { vi: 'Không thể lấy thống kê chiến dịch', en: 'Failed to get campaign stats' }
} as const;

function isValidStatusTransition(from: CampaignStatus, to: CampaignStatus): boolean {
	const transitions: Record<CampaignStatus, CampaignStatus[]> = {
		draft: ['active', 'cancelled'],
		active: ['paused', 'completed', 'cancelled'],
		paused: ['active', 'completed', 'cancelled'],
		completed: [],
		cancelled: []
	};
	return transitions[from]?.includes(to) ?? false;
}

export class CampaignService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string
	): Promise<boolean> {
		return PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			actorUserId: actor.userId
		});
	}

	static async listCampaigns(actor: ActorContext, filters: CampaignListFilters = {}) {
		if (!(await this.requirePermission(actor, 'campaigns:read'))) {
			return { success: false as const, messages: adminMessages.permissionDenied };
		}

		const page = Math.max(1, filters.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: (string | number)[] = [];
		let argIndex = 1;

		if (filters.type) {
			conditions.push(`c.type = $${argIndex++}`);
			args.push(filters.type);
		}
		if (filters.status) {
			conditions.push(`c.status = $${argIndex++}`);
			args.push(filters.status);
		}
		if (filters.from) {
			conditions.push(`c.startAt >= $${argIndex++}`);
			args.push(filters.from);
		}
		if (filters.to) {
			conditions.push(`c.endAt <= $${argIndex++}`);
			args.push(filters.to);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		try {
			const countQuery = `SELECT RAW COUNT(*) FROM ${campaignsKeyspace} c ${whereClause}`;
			const dataQuery = `SELECT c.*, META().id AS _id FROM ${campaignsKeyspace} c ${whereClause} ORDER BY c.createdAt DESC LIMIT $${argIndex++} OFFSET $${argIndex++}`;
			const [countRes, dataRes] = await Promise.all([
				cbCampaigns.document.query({ statement: countQuery, args, readonly: true }),
				cbCampaigns.document.query({
					statement: dataQuery,
					args: [...args, pageSize, offset],
					readonly: true
				})
			]);

			if (!countRes.ok || !dataRes.ok) {
				return { success: false as const, messages: adminMessages.queryFailed };
			}

			const total = Number(countRes.data?.results?.[0] ?? 0);
			const items = (dataRes.data?.results ?? []).map((row: Record<string, unknown>) =>
				sanitizeCampaignForAdmin(row)
			);

			return { success: true as const, items, total, page, pageSize };
		} catch (e) {
			console.error('[CampaignService.listCampaigns]', e);
			return { success: false as const, messages: adminMessages.queryFailed };
		}
	}

	static async getCampaign(actor: ActorContext, campaignId: string) {
		if (!(await this.requirePermission(actor, 'campaigns:read'))) {
			return { success: false as const, messages: adminMessages.permissionDenied };
		}

		try {
			const res = await cbCampaigns.document.query({
				statement: `SELECT c.*, META().id AS _id FROM ${campaignsKeyspace} c WHERE c.campaignId = $1 LIMIT 1`,
				args: [campaignId],
				readonly: true
			});
			const doc = res.data?.results?.[0];
			if (!doc) {
				return { success: false as const, messages: adminMessages.notFound };
			}
			return { success: true as const, data: sanitizeCampaignForAdmin(doc) };
		} catch (e) {
			console.error('[CampaignService.getCampaign]', e);
			return { success: false as const, messages: adminMessages.queryFailed };
		}
	}

	static async createCampaign(
		actor: ActorContext,
		input: {
			name: string;
			type: CampaignType;
			description?: string;
			budget?: number;
			targetCount?: number;
			segmentRules?: CampaignSegmentRule[];
			promotionIds?: string[];
			startAt?: string;
			endAt?: string;
		}
	) {
		if (!(await this.requirePermission(actor, 'campaigns:manage'))) {
			return { success: false as const, messages: adminMessages.permissionDenied };
		}

		const now = new Date().toISOString();
		const documentKey = `campaign_${input.name.replace(/\s+/g, '_').slice(0, 32)}_${Date.now()}`;
		const campaignId = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

		const content: CampaignDocument = {
			campaignId,
			name: input.name,
			type: input.type,
			status: 'draft',
			promotionIds: input.promotionIds ?? [],
			segmentRules: input.segmentRules ?? [],
			targetCount: input.targetCount ?? 0,
			reachedCount: 0,
			spent: 0,
			createdAt: now,
			updatedAt: now
		};
		if (input.description !== undefined) content.description = input.description;
		if (input.budget !== undefined) content.budget = input.budget;
		if (input.startAt !== undefined) content.startAt = input.startAt;
		if (input.endAt !== undefined) content.endAt = input.endAt;

		try {
			await cbCampaigns.document.create({ documentKey, content });
			return {
				success: true as const,
				data: sanitizeCampaignForAdmin({ ...content, _id: documentKey })
			};
		} catch (e) {
			console.error('[CampaignService.createCampaign]', e);
			return { success: false as const, messages: adminMessages.createFailed };
		}
	}

	static async updateCampaign(
		actor: ActorContext,
		campaignId: string,
		updates: Partial<{
			name: string;
			description: string;
			type: CampaignType;
			budget: number;
			targetCount: number;
			segmentRules: CampaignSegmentRule[];
			promotionIds: string[];
			startAt: string;
			endAt: string;
		}>
	) {
		if (!(await this.requirePermission(actor, 'campaigns:manage'))) {
			return { success: false as const, messages: adminMessages.permissionDenied };
		}

		try {
			const existing = await this.getCampaignUnchecked(campaignId);
			if (!existing) {
				return { success: false as const, messages: adminMessages.notFound };
			}

			const allowed = [
				'name',
				'description',
				'type',
				'budget',
				'targetCount',
				'segmentRules',
				'promotionIds',
				'startAt',
				'endAt'
			] as const;
			const setClauses: string[] = [];
			const args: (string | number | CampaignSegmentRule[] | string[])[] = [];
			let argIndex = 1;
			for (const key of allowed) {
				if (updates[key] !== undefined) {
					setClauses.push(`${key} = $${argIndex++}`);
					args.push(updates[key] as string | number);
				}
			}
			if (!setClauses.length) {
				return { success: true as const, data: sanitizeCampaignForAdmin(existing) };
			}

			setClauses.push(`updatedAt = $${argIndex++}`);
			args.push(new Date().toISOString());

			const query = `UPDATE ${campaignsKeyspace} SET ${setClauses.join(', ')} WHERE campaignId = $${argIndex++} RETURNING c.*`;
			const res = await cbCampaigns.document.query({
				statement: query,
				args: [...args, campaignId]
			});
			const updated = res.data?.results?.[0];
			if (!updated) {
				return { success: false as const, messages: adminMessages.notFound };
			}
			return { success: true as const, data: sanitizeCampaignForAdmin(updated) };
		} catch (e) {
			console.error('[CampaignService.updateCampaign]', e);
			return { success: false as const, messages: adminMessages.updateFailed };
		}
	}

	static async launchCampaign(actor: ActorContext, campaignId: string) {
		if (!(await this.requirePermission(actor, 'campaigns:manage'))) {
			return { success: false as const, messages: adminMessages.permissionDenied };
		}
		return this.transitionStatus(campaignId, 'active');
	}

	static async pauseCampaign(actor: ActorContext, campaignId: string) {
		if (!(await this.requirePermission(actor, 'campaigns:manage'))) {
			return { success: false as const, messages: adminMessages.permissionDenied };
		}
		return this.transitionStatus(campaignId, 'paused');
	}

	static async completeCampaign(actor: ActorContext, campaignId: string) {
		if (!(await this.requirePermission(actor, 'campaigns:manage'))) {
			return { success: false as const, messages: adminMessages.permissionDenied };
		}
		return this.transitionStatus(campaignId, 'completed');
	}

	static async cancelCampaign(actor: ActorContext, campaignId: string) {
		if (!(await this.requirePermission(actor, 'campaigns:manage'))) {
			return { success: false as const, messages: adminMessages.permissionDenied };
		}
		return this.transitionStatus(campaignId, 'cancelled');
	}

	private static async transitionStatus(campaignId: string, to: CampaignStatus) {
		try {
			const existing = await this.getCampaignUnchecked(campaignId);
			if (!existing) {
				return { success: false as const, messages: adminMessages.notFound };
			}
			const from = existing.status as CampaignStatus;
			if (!isValidStatusTransition(from, to)) {
				return { success: false as const, messages: adminMessages.invalidStatusTransition };
			}

			const now = new Date().toISOString();
			const res = await cbCampaigns.document.query({
				statement: `UPDATE ${campaignsKeyspace} SET status = $1, updatedAt = $2 WHERE campaignId = $3 RETURNING c.*`,
				args: [to, now, campaignId]
			});
			const updated = res.data?.results?.[0];
			if (!updated) {
				return { success: false as const, messages: adminMessages.notFound };
			}
			return { success: true as const, data: sanitizeCampaignForAdmin(updated) };
		} catch (e) {
			console.error('[CampaignService.transitionStatus]', e);
			return { success: false as const, messages: adminMessages.updateFailed };
		}
	}

	static async linkPromotions(actor: ActorContext, campaignId: string, promotionIds: string[]) {
		if (!(await this.requirePermission(actor, 'campaigns:manage'))) {
			return { success: false as const, messages: adminMessages.permissionDenied };
		}

		try {
			const existing = await this.getCampaignUnchecked(campaignId);
			if (!existing) {
				return { success: false as const, messages: adminMessages.notFound };
			}

			if (promotionIds.length) {
				const cbPromotions = cbData('promotions');
				const promotionsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`promotions\``;
				// promotions không có field promotionId trong content — id chính là META().id (documentKey)
				const marks = promotionIds.map((_, i) => `$${i + 1}`).join(', ');
				const check = await cbPromotions.document.query({
					statement: `SELECT RAW COUNT(*) FROM ${promotionsKeyspace} p WHERE META().id IN [${marks}]`,
					args: promotionIds,
					readonly: true
				});
				const found = check.data?.results?.[0] ?? 0;
				if (found < promotionIds.length) {
					return { success: false as const, messages: adminMessages.promotionNotFound };
				}
			}

			const merged = Array.from(
				new Set([...((existing.promotionIds as string[]) ?? []), ...promotionIds])
			);
			const now = new Date().toISOString();
			const res = await cbCampaigns.document.query({
				statement: `UPDATE ${campaignsKeyspace} SET promotionIds = $1, updatedAt = $2 WHERE campaignId = $3 RETURNING c.*`,
				args: [merged, now, campaignId]
			});
			const updated = res.data?.results?.[0];
			if (!updated) {
				return { success: false as const, messages: adminMessages.notFound };
			}
			return { success: true as const, data: sanitizeCampaignForAdmin(updated) };
		} catch (e) {
			console.error('[CampaignService.linkPromotions]', e);
			return { success: false as const, messages: adminMessages.updateFailed };
		}
	}

	static async deleteCampaign(actor: ActorContext, campaignId: string) {
		if (!(await this.requirePermission(actor, 'campaigns:manage'))) {
			return { success: false as const, messages: adminMessages.permissionDenied };
		}

		try {
			const existing = await this.getCampaignUnchecked(campaignId);
			if (!existing) {
				return { success: false as const, messages: adminMessages.notFound };
			}
			await cbCampaigns.document.query({
				statement: `DELETE FROM ${campaignsKeyspace} WHERE campaignId = $1`,
				args: [campaignId]
			});
			return { success: true as const };
		} catch (e) {
			console.error('[CampaignService.deleteCampaign]', e);
			return { success: false as const, messages: adminMessages.deleteFailed };
		}
	}

	static async getStats(actor: ActorContext, campaignId?: string) {
		if (!(await this.requirePermission(actor, 'campaigns:read'))) {
			return { success: false as const, messages: adminMessages.permissionDenied };
		}

		try {
			if (campaignId) {
				const existing = await this.getCampaignUnchecked(campaignId);
				if (!existing) {
					return { success: false as const, messages: adminMessages.notFound };
				}
				return {
					success: true as const,
					data: {
						campaignId,
						targetCount: existing.targetCount ?? 0,
						reachedCount: existing.reachedCount ?? 0,
						budget: existing.budget ?? 0,
						spent: existing.spent ?? 0
					}
				};
			}

			const res = await cbCampaigns.document.query({
				statement: `SELECT c.status, RAW COUNT(*) AS cnt FROM ${campaignsKeyspace} c GROUP BY c.status`,
				args: [],
				readonly: true
			});
			const byStatus: Record<string, number> = {};
			for (const row of res.data?.results ?? []) {
				byStatus[row.status] = row.cnt;
			}
			const totals = await cbCampaigns.document.query({
				statement: `SELECT RAW SUM(targetCount) AS totalTarget, RAW SUM(reachedCount) AS totalReached, RAW SUM(budget) AS totalBudget, RAW SUM(spent) AS totalSpent FROM ${campaignsKeyspace}`,
				args: [],
				readonly: true
			});
			const t = totals.data?.results?.[0] ?? {};
			return {
				success: true as const,
				data: {
					byStatus,
					totalTarget: t.totalTarget ?? 0,
					totalReached: t.totalReached ?? 0,
					totalBudget: t.totalBudget ?? 0,
					totalSpent: t.totalSpent ?? 0
				}
			};
		} catch (e) {
			console.error('[CampaignService.getStats]', e);
			return { success: false as const, messages: adminMessages.statsFailed };
		}
	}

	private static async getCampaignUnchecked(campaignId: string) {
		const res = await cbCampaigns.document.query({
			statement: `SELECT c.*, META().id AS _id FROM ${campaignsKeyspace} c WHERE c.campaignId = $1 LIMIT 1`,
			args: [campaignId],
			readonly: true
		});
		return res.data?.results?.[0] ?? null;
	}
}
