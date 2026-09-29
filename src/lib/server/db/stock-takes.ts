// $lib/server/db/stock-takes.ts

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';

const cbStockTakes = cbData('stock_takes');
const stockTakesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`stock_takes\``;

const stockTakeAdminMessages = {
  notFound: {
    vi: 'Không tìm thấy kiểm kê kho',
    en: 'Stock take not found'
  } as TranslateContent,
  queryFailed: {
    vi: 'Truy vấn thất bại',
    en: 'Query failed'
  } as TranslateContent,
  createFailed: {
    vi: 'Tạo kiểm kê kho thất bại',
    en: 'Failed to create stock take'
  } as TranslateContent,
  updateFailed: {
    vi: 'Cập nhật kiểm kê kho thất bại',
    en: 'Failed to update stock take'
  } as TranslateContent,
  permissionDenied: {
    vi: 'Bạn không có quyền thực hiện thao tác này',
    en: 'You do not have permission to perform this action'
  } as TranslateContent,
  invalidStatus: {
    vi: 'Trạng thái kiểm kê không hợp lệ',
    en: 'Invalid stock take status'
  } as TranslateContent,
  varianceFound: {
    vi: 'Phát hiện chênh lệch tồn kho',
    en: 'Stock variance detected'
  } as TranslateContent
} as const;

const STOCK_TAKE_ADMIN_SAFE_FIELDS = [
  'branchId',
  'referenceNumber',
  'status',
  'startedBy',
  'completedBy',
  'totalItems',
  'totalVariance',
  'variancePercentage',
  'notes',
  'startedAt',
  'completedAt'
] as const;

function sanitizeStockTakeForAdmin(doc: any & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of STOCK_TAKE_ADMIN_SAFE_FIELDS) {
    safe[field] = doc[field];
  }
  return safe;
}

interface ListResult {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActorContext {
  roleName: string;
  userId: string;
  branchId?: string;
}

export interface StockTakeItem {
  variantId: string;
  lotId?: string;
  systemQuantity: number;
  countedQuantity: number;
  variance: number;
  varianceReason?: string;
}

export class StockTakeService {
  private static async requirePermission(
    actor: ActorContext,
    permissionKey: string
  ): Promise<{ success: false; messages: TranslateContent } | null> {
    const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
      branchId: actor.branchId,
      actorUserId: actor.userId
    });
    if (!allowed) return { success: false, messages: stockTakeAdminMessages.permissionDenied };
    return null;
  }

  // ========== STOCK TAKES ==========

  /**
   * Create a new stock take audit.
   */
  static async createStockTake(
    actor: ActorContext,
    stockTakeData: {
      referenceNumber: string;
      notes?: string;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { stockTake: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'stock_takes:manage');
    if (permError) return permError;

    const stockTakeId = `st_${actor.branchId}_${Date.now()}`;
    const now = new Date().toISOString();

    const stockTake = {
      branchId: actor.branchId,
      referenceNumber: stockTakeData.referenceNumber,
      status: 'draft',
      startedBy: actor.userId,
      completedBy: null,
      items: [] as StockTakeItem[],
      totalItems: 0,
      totalVariance: 0,
      variancePercentage: 0,
      notes: stockTakeData.notes ?? '',
      startedAt: now,
      completedAt: null
    };

    const createRes = await cbStockTakes.document.create({
      documentKey: stockTakeId,
      content: stockTake
    });

    if (!createRes.ok) {
      return { success: false, messages: stockTakeAdminMessages.createFailed };
    }

    return { success: true, stockTake: sanitizeStockTakeForAdmin({...stockTake, _id: stockTakeId}) };
  }

  /**
   * Get a stock take.
   */
  static async getStockTake(
    actor: ActorContext,
    stockTakeId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { stockTake: Record<string, unknown>; items: StockTakeItem[] })> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'stock_takes:read');
    if (!scope) return { success: false, messages: stockTakeAdminMessages.permissionDenied };

    const res = await cbStockTakes.document.get({ documentKey: stockTakeId });

    if (!res.ok) {
      return { success: false, messages: stockTakeAdminMessages.notFound };
    }

    const stockTake = (res as any).data;
    return {
      success: true,
      stockTake: sanitizeStockTakeForAdmin({...stockTake, _id: stockTakeId}),
      items: stockTake.items ?? []
    };
  }

  /**
   * Add/update items to stock take.
   */
  static async addStockTakeItem(
    actor: ActorContext,
    stockTakeId: string,
    item: StockTakeItem
  ): Promise<{ success: false; messages: TranslateContent } | { success: true }> {
    const permError = await this.requirePermission(actor, 'stock_takes:manage');
    if (permError) return permError;

    const getRes = await cbStockTakes.document.get({ documentKey: stockTakeId });
    if (!getRes.ok) {
      return { success: false, messages: stockTakeAdminMessages.notFound };
    }

    const stockTake = (getRes as any).data;

    if (stockTake.status !== 'draft' && stockTake.status !== 'in_progress') {
      return { success: false, messages: stockTakeAdminMessages.invalidStatus };
    }

    // Find or add item
    const items = stockTake.items ?? [];
    const itemIndex = items.findIndex(
      (i: StockTakeItem) => i.variantId === item.variantId && i.lotId === item.lotId
    );

    if (itemIndex >= 0) {
      items[itemIndex] = item;
    } else {
      items.push(item);
    }

    // Recalculate totals
    let totalVariance = 0;
    let totalSystemQty = 0;

    for (const it of items) {
      totalVariance += Math.abs(it.variance);
      totalSystemQty += it.systemQuantity;
    }

    const variancePercentage = totalSystemQty > 0 ? (totalVariance / totalSystemQty) * 100 : 0;

    const updatedStockTake = {
      ...stockTake,
      items,
      totalItems: items.length,
      totalVariance,
      variancePercentage
    };

    const updateRes = await cbStockTakes.document.update({
      documentKey: stockTakeId,
      content: updatedStockTake
    });

    if (!updateRes.ok) {
      return { success: false, messages: stockTakeAdminMessages.updateFailed };
    }

    return { success: true };
  }

  /**
   * Start stock take (transition from draft to in_progress).
   */
  static async startStockTake(
    actor: ActorContext,
    stockTakeId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { stockTake: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'stock_takes:manage');
    if (permError) return permError;

    const getRes = await cbStockTakes.document.get({ documentKey: stockTakeId });
    if (!getRes.ok) {
      return { success: false, messages: stockTakeAdminMessages.notFound };
    }

    const stockTake = (getRes as any).data;

    if (stockTake.status !== 'draft') {
      return { success: false, messages: stockTakeAdminMessages.invalidStatus };
    }

    const updatedStockTake = {
      ...stockTake,
      status: 'in_progress'
    };

    const updateRes = await cbStockTakes.document.update({
      documentKey: stockTakeId,
      content: updatedStockTake
    });

    if (!updateRes.ok) {
      return { success: false, messages: stockTakeAdminMessages.updateFailed };
    }

    return { success: true, stockTake: sanitizeStockTakeForAdmin({...updatedStockTake, _id: stockTakeId}) };
  }

  /**
   * Complete stock take (transition to completed).
   */
  static async completeStockTake(
    actor: ActorContext,
    stockTakeId: string,
    completionData?: {
      notes?: string;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { stockTake: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'stock_takes:manage');
    if (permError) return permError;

    const getRes = await cbStockTakes.document.get({ documentKey: stockTakeId });
    if (!getRes.ok) {
      return { success: false, messages: stockTakeAdminMessages.notFound };
    }

    const stockTake = (getRes as any).data;

    if (stockTake.status !== 'in_progress') {
      return { success: false, messages: stockTakeAdminMessages.invalidStatus };
    }

    const now = new Date().toISOString();

    const updatedStockTake = {
      ...stockTake,
      status: 'completed',
      completedBy: actor.userId,
      notes: (stockTake.notes ?? '') + (completionData?.notes ? `\n${completionData.notes}` : ''),
      completedAt: now
    };

    const updateRes = await cbStockTakes.document.update({
      documentKey: stockTakeId,
      content: updatedStockTake
    });

    if (!updateRes.ok) {
      return { success: false, messages: stockTakeAdminMessages.updateFailed };
    }

    return { success: true, stockTake: sanitizeStockTakeForAdmin({...updatedStockTake, _id: stockTakeId}) };
  }

  /**
   * List stock takes.
   */
  static async listStockTakes(
    actor: ActorContext,
    options: {
      status?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & ListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'stock_takes:read');
    if (!scope) return { success: false, messages: stockTakeAdminMessages.permissionDenied };

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (scope === 'own_branch') {
      conditions.push('branchId = $' + (args.length + 1));
      args.push(actor.branchId!);
    }

    if (options.status) {
      conditions.push('status = $' + (args.length + 1));
      args.push(options.status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const selectClause = 'META().id AS _id, ' + STOCK_TAKE_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

    const [countRes, dataRes] = await Promise.all([
      cbStockTakes.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${stockTakesKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbStockTakes.document.query({
        statement: `SELECT ${selectClause} FROM ${stockTakesKeyspace} ${whereClause} ORDER BY startedAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: stockTakeAdminMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizeStockTakeForAdmin);

    return { success: true, items, total, page, pageSize };
  }
}
