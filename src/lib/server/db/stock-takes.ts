// $lib/server/db/stock-takes.ts

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { InventoryService } from './inventory';

const cbStockTakes = cbData('stock_takes');
const stockTakesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`stock_takes\``;

const stockTakesAdminMessages = {
  notFound: {
    vi: 'Không tìm thấy kiểm kho',
    en: 'Stock take not found'
  } as TranslateContent,
  queryFailed: {
    vi: 'Truy vấn thất bại',
    en: 'Query failed'
  } as TranslateContent,
  createFailed: {
    vi: 'Không thể tạo kiểm kho',
    en: 'Failed to create stock take'
  } as TranslateContent,
  updateFailed: {
    vi: 'Không thể cập nhật kiểm kho',
    en: 'Failed to update stock take'
  } as TranslateContent,
  permissionDenied: {
    vi: 'Bạn không có quyền thực hiện thao tác này',
    en: 'You do not have permission to perform this action'
  } as TranslateContent,
  invalidStatus: {
    vi: 'Trạng thái kiểm kho không hợp lệ',
    en: 'Invalid stock take status'
  } as TranslateContent,
  alreadyStarted: {
    vi: 'Kiểm kho đã được bắt đầu',
    en: 'Stock take already started'
  } as TranslateContent,
  notInProgress: {
    vi: 'Kiểm kho không ở trạng thái đang tiến hành',
    en: 'Stock take is not in progress'
  } as TranslateContent
} as const;

const STOCK_TAKE_SAFE_FIELDS = [
  'branchId',
  'startedBy',
  'approvedBy',
  'status',
  'startedAt',
  'completedAt',
  'approvedAt',
  'items',
  'variance',
  'discrepancies'
] as const;

function sanitizeStockTakeForAdmin(doc: any & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of STOCK_TAKE_SAFE_FIELDS) {
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

export class StockTakesService {
  private static async requirePermission(
    actor: ActorContext,
    permissionKey: string
  ): Promise<{ success: false; messages: TranslateContent } | null> {
    const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
      branchId: actor.branchId,
      actorUserId: actor.userId
    });
    if (!allowed) return { success: false, messages: stockTakesAdminMessages.permissionDenied };
    return null;
  }

  /**
   * Start a new stock take.
   */
  static async startStockTake(
    actor: ActorContext,
    data: {
      branchId: string;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { stockTake: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'inventory:manage');
    if (permError) return permError;

    const stockTakeId = `st_${data.branchId}_${Date.now()}`;
    const now = new Date().toISOString();

    const stockTake = {
      branchId: data.branchId,
      startedBy: actor.userId,
      approvedBy: null,
      status: 'in_progress',
      startedAt: now,
      completedAt: null,
      approvedAt: null,
      items: [],
      variance: null,
      discrepancies: []
    };

    const createRes = await cbStockTakes.document.create({
      documentKey: stockTakeId,
      content: stockTake
    });

    if (!createRes.ok) {
      return { success: false, messages: stockTakesAdminMessages.createFailed };
    }

    return { success: true, stockTake: sanitizeStockTakeForAdmin({...stockTake, _id: stockTakeId}) };
  }

  /**
   * Add counted items to a stock take.
   */
  static async addCountedItems(
    actor: ActorContext,
    data: {
      stockTakeId: string;
      items: Array<{
        variantId: string;
        lotId: string;
        systemQuantity: number;
        countedQuantity: number;
      }>;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { updated: boolean })> {
    const permError = await this.requirePermission(actor, 'inventory:manage');
    if (permError) return permError;

    const getRes = await cbStockTakes.document.get({ documentKey: data.stockTakeId });

    if (!getRes.ok) {
      return { success: false, messages: stockTakesAdminMessages.notFound };
    }

    const stockTake = (getRes as any).data;

    if (stockTake.status !== 'in_progress') {
      return { success: false, messages: stockTakesAdminMessages.notInProgress };
    }

    const discrepancies = data.items
      .filter((item) => item.systemQuantity !== item.countedQuantity)
      .map((item) => ({
        variantId: item.variantId,
        lotId: item.lotId,
        systemQuantity: item.systemQuantity,
        countedQuantity: item.countedQuantity,
        variance: item.countedQuantity - item.systemQuantity
      }));

    const updateRes = await cbStockTakes.document.update({
      documentKey: data.stockTakeId,
      content: {
        ...stockTake,
        items: data.items,
        discrepancies
      }
    });

    if (!updateRes.ok) {
      return { success: false, messages: stockTakesAdminMessages.updateFailed };
    }

    return { success: true, updated: true };
  }

  /**
   * Complete and approve a stock take.
   */
  static async completeStockTake(
    actor: ActorContext,
    stockTakeId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { stockTake: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'inventory:approve');
    if (permError) return permError;

    const getRes = await cbStockTakes.document.get({ documentKey: stockTakeId });

    if (!getRes.ok) {
      return { success: false, messages: stockTakesAdminMessages.notFound };
    }

    const stockTake = (getRes as any).data;

    if (stockTake.status !== 'in_progress') {
      return { success: false, messages: stockTakesAdminMessages.notInProgress };
    }

    const now = new Date().toISOString();

    const updateRes = await cbStockTakes.document.update({
      documentKey: stockTakeId,
      content: {
        ...stockTake,
        status: 'completed',
        completedAt: now,
        approvedBy: actor.userId,
        approvedAt: now
      }
    });

    if (!updateRes.ok) {
      return { success: false, messages: stockTakesAdminMessages.updateFailed };
    }

    const completedStockTake = {
      ...stockTake,
      status: 'completed',
      completedAt: now,
      approvedBy: actor.userId,
      approvedAt: now
    };

    return { success: true, stockTake: sanitizeStockTakeForAdmin({...completedStockTake, _id: stockTakeId}) };
  }

  /**
   * Apply stock adjustments from a completed stock take.
   */
  static async applyAdjustments(
    actor: ActorContext,
    stockTakeId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { applied: boolean })> {
    const permError = await this.requirePermission(actor, 'inventory:manage');
    if (permError) return permError;

    const getRes = await cbStockTakes.document.get({ documentKey: stockTakeId });

    if (!getRes.ok) {
      return { success: false, messages: stockTakesAdminMessages.notFound };
    }

    const stockTake = (getRes as any).data;

    if (stockTake.status !== 'completed') {
      return { success: false, messages: stockTakesAdminMessages.invalidStatus };
    }

    // Apply adjustments for each discrepancy
    for (const discrepancy of stockTake.discrepancies || []) {
      if (discrepancy.variance !== 0) {
        await InventoryService.adjustStock(
          actor,
          discrepancy.variantId,
          stockTake.branchId,
          discrepancy.variance,
          'stock_take',
          stockTakeId,
          actor.userId,
          `Stock take adjustment: counted ${discrepancy.countedQuantity}, system ${discrepancy.systemQuantity}`
        );
      }
    }

    return { success: true, applied: true };
  }

  /**
   * List stock takes.
   */
  static async listStockTakes(
    actor: ActorContext,
    options: {
      branchId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & ListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:read');
    if (!scope) return { success: false, messages: stockTakesAdminMessages.permissionDenied };

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (options.branchId) {
      conditions.push('branchId = $' + (args.length + 1));
      args.push(options.branchId);
    }

    if (options.status) {
      conditions.push('status = $' + (args.length + 1));
      args.push(options.status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const selectClause = 'META().id AS _id, ' + STOCK_TAKE_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

    const [countRes, dataRes] = await Promise.all([
      cbStockTakes.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${stockTakesKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbStockTakes.document.query({
        statement: `SELECT ${selectClause} FROM ${stockTakesKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: stockTakesAdminMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizeStockTakeForAdmin);

    return { success: true, items, total, page, pageSize };
  }

  /**
   * Get a specific stock take.
   */
  static async getStockTake(
    actor: ActorContext,
    stockTakeId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { stockTake: Record<string, unknown> })> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:read');
    if (!scope) return { success: false, messages: stockTakesAdminMessages.permissionDenied };

    const res = await cbStockTakes.document.get({ documentKey: stockTakeId });

    if (!res.ok) {
      return { success: false, messages: stockTakesAdminMessages.notFound };
    }

    const stockTake = (res as any).data;
    return { success: true, stockTake: sanitizeStockTakeForAdmin({...stockTake, _id: stockTakeId}) };
  }
}
