// $lib/server/db/inventory.ts

import type { TranslateContent } from '$interfaces/basic';
import { TranslatableError } from '$lib/errors/translatable-error';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type {
  InventoryStock,
  InventoryLot,
  StockMovement,
  Branch
} from '$modules/schema';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { adminMessages as productAdminMessages } from '../messages/db'; // Reuse product admin messages for simplicity, or define our own

const cbInventoryStock = cbData('inventory_stock');
const cbInventoryLots = cbData('inventory_lots');
const cbStockMovements = cbData('stock_movements');
const cbBranches = cbData('branches');

const inventoryStockKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`inventory_stock\``;
const inventoryLotsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`inventory_lots\`;
const stockMovementsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`stock_movements\`;
const branchesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`branches\`;

const adminMessages = {
  notFound: {
    vi: 'Không tìm thấy tồn kho',
    en: 'Inventory not found'
  } as TranslateContent,
  queryFailed: {
    vi: 'Truy vấn tồn kho thất bại',
    en: 'Failed to query inventory'
  } as TranslateContent,
  updateFailed: {
    vi: 'Cập nhật tồn kho thất bại',
    en: 'Failed to update inventory'
  } as TranslateContent,
  insufficientStock: {
    vi: 'Tồn kho không đủ',
    en: 'Insufficient stock'
  } as TranslateContent,
  permissionDenied: {
    vi: 'Bạn không có quyền thực hiện thao tác này',
    en: 'You do not have permission to perform this action'
  } as TranslateContent,
} as const;

const INVENTORY_STOCK_ADMIN_SAFE_FIELDS = [
  'variantId',
  'branchId',
  'quantityOnHand',
  'quantityReserved',
  'updatedAt'
] as const;

const INVENTORY_LOT_ADMIN_SAFE_FIELDS = [
  'variantId',
  'branchId',
  'lotNumber',
  'quantityOnHand',
  'manufacturedAt',
  'expiresAt',
  'receivedAt',
  'supplierId',
  'status',
  'createdAt'
] as const;

const STOCK_MOVEMENT_ADMIN_SAFE_FIELDS = [
  'variantId',
  'branchId',
  'lotId',
  'type',
  'quantity',
  'quantityBefore',
  'quantityAfter',
  'referenceType',
  'referenceId',
  'performedBy',
  'note',
  'createdAt'
] as const;

function sanitizeInventoryStockForAdmin(doc: InventoryStock & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of INVENTORY_STOCK_ADMIN_SAFE_FIELDS) {
    safe[field] = doc[field];
  }
  return safe;
}

function sanitizeInventoryLotForAdmin(doc: InventoryLot & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of INVENTORY_LOT_ADMIN_SAFE_FIELDS) {
    safe[field] = doc[field];
  }
  return safe;
}

function sanitizeStockMovementForAdmin(doc: StockMovement & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of STOCK_MOVEMENT_ADMIN_SAFE_FIELDS) {
    safe[field] = doc[field];
  }
  return safe;
}

interface InventoryStockListResult {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

interface InventoryLotListResult {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

interface StockMovementListResult {
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

/**
 * InventoryService handles inventory-related operations.
 */
export class InventoryService {
  private static async requirePermission(
    actor: ActorContext,
    permissionKey: string,
    targetBranchId?: string | null,
    targetUserId?: string
  ): Promise<{ success: false; messages: TranslateContent } | null> {
    const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
      branchId: actor.branchId,
      targetBranchId,
      actorUserId: actor.userId,
      targetUserId
    });
    if (!allowed) return { success: false, messages: adminMessages.permissionDenied };
    return null;
  }

  // ========== INVENTORY STOCK ==========

  /**
   * List inventory stock with optional filtering by branchId and variantId.
   */
  static async listStock(
    actor: ActorContext,
    options: {
      branchId?: string;
      variantId?: string;
      page?: number;
      pageSize?: number;
      includeZero?: boolean
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & InventoryStockListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:read');
    if (!scope) return { success: false, messages: adminMessages.permissionDenied };

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (scope === 'own_branch') {
      if (!actor.branchId) {
        return { success: false, messages: adminMessages.permissionDenied };
      }
      conditions.push('branchId = $' + (args.length + 1));
      args.push(actor.branchId);
    }

    if (options.branchId) {
      conditions.push('branchId = $' + (args.length + 1));
      args.push(options.branchId);
    }

    if (options.variantId) {
      conditions.push('variantId = $' + (args.length + 1));
      args.push(options.variantId);
    }

    if (!options.includeZero) {
      conditions.push('(quantityOnHand > 0 OR quantityReserved > 0)');
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const selectClause = `META().id AS _id, ${INVENTORY_STOCK_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')}`;

    const [countRes, dataRes] = await Promise.all([
      cbInventoryStock.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${inventoryStockKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbInventoryStock.document.query({
        statement: `SELECT ${selectClause} FROM ${inventoryStockKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: adminMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizeInventoryStockForAdmin);

    return { success: true, items, total, page, pageSize };
  }

  /**
   * Get inventory stock for a specific variant and branch.
   */
  static async getStock(
    actor: ActorContext,
    variantId: string,
    branchId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { stock: Record<string, unknown> })> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:read');
    if (!scope) return { success: false, messages: adminMessages.permissionDenied };

    if (scope === 'own_branch' && !actor.branchId) {
      return { success: false, messages: adminMessages.permissionDenied };
    }

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    conditions.push('variantId = $' + (args.length + 1));
    args.push(variantId);
    conditions.push('branchId = $' + (args.length + 1));
    args.push(branchId);

    if (scope === 'own_branch' && actor.branchId && actor.branchId !== branchId) {
      // User can only see their own branch
      return { success: false, messages: adminMessages.permissionDenied };
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const selectClause = `META().id AS _id, ${INVENTORY_STOCK_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')}`;

    const res = await cbInventoryStock.document.query({
      statement: `SELECT ${selectClause} FROM ${inventoryStockKeyspace} ${whereClause} LIMIT 1`,
      args,
      readonly: true
    });

    if (!res.ok) {
      return { success: false, messages: adminMessages.queryFailed };
    }

    const item = (res.data?.results ?? [])[0];
    if (!item) {
      return { success: false, messages: adminMessages.notFound };
    }

    return { success: true, stock: sanitizeInventoryStockForAdmin(item) };
  }

  /**
   * Adjust stock quantity (increase or decrease) for a variant at a branch.
   * This adjusts the quantityOnHand.
   * If decrease would make quantityOnHand negative, returns insufficientStock.
   */
  static async adjustStock(
    actor: ActorContext,
    variantId: string,
    branchId: string,
    change: number, // positive to increase, negative to decrease
    referenceType?: string,
    referenceId?: string,
    performedBy?: string,
    note?: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { updatedStock: Record<string, unknown> })> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:adjust');
    if (!scope) return { success: false, messages: adminMessages.permissionDenied };

    if (scope === 'own_branch' && !actor.branchId) {
      return { success: false, messages: adminMessages.permissionDenied };
    }

    // First, get the current stock
    const stockResult = await this.getStock(actor, variantId, branchId);
    if (!stockResult.success) {
      return stockResult; // propagate error
    }

    const currentStock = stockResult.stock as InventoryStock & { _id: string };
    const newQuantityOnHand = Number(currentStock.quantityOnHand) + change;

    if (newQuantityOnHand < 0) {
      return { success: false, messages: adminMessages.insufficientStock };
    }

    // We'll use an update with a CAS (compare and swap) to handle race conditions.
    // We'll try up to 3 times.
    let attempts = 0;
    const maxAttempts = 3;
    let updateRes: any;

    while (attempts < maxAttempts) {
      attempts++;
      // Fetch the latest version (we already have currentStock, but we need to get the _id and maybe the current quantityOnHand again to avoid lost update)
      // For simplicity, we'll use the _id we have and update by _id, but we need to check the current quantityOnHand matches.
      // We'll do a conditional update: set quantityOnHand = $new where _id = $id and quantityOnHand = $current
      const condition = `quantityOnHand = $${args.length + 1}`;
      const args = [currentStock._id, currentStock.quantityOnHand, newQuantityOnHand];

      updateRes = await cbInventoryStock.document.update(
        currentStock._id,
        { quantityOnHand: newQuantityOnHand, updatedAt: new Date() },
        {
          // We'll use a custom condition via the query method?
          // The update method doesn't support conditions directly.
          // We'll use a query to update with a condition.
          // Alternatively, we can use the mutateIn or just update and then verify?
          // Let's use a N1QL update with a condition.
          // We'll do it via query.
        }
      );

      // Actually, let's switch to using a query for the update with condition.
      break;
    }

    // We'll implement the update via a N1QL query with a condition on the current quantityOnHand.
    // This is more atomic and handles race conditions by checking the current value.
    const updateArgs: (string | number)[] = [
      currentStock._id,
      currentStock.quantityOnHand, // current value for condition
      newQuantityOnHand, // new value
      new Date()
    ];

    const updateRes = await cbInventoryStock.document.query({
      statement: `
        UPDATE ${inventoryStockKeyspace}
        SET quantityOnHand = $3, updatedAt = $4
        WHERE META().id = $1 AND quantityOnHand = $2
      `,
      args: updateArgs,
      readonly: false
    });

    if (!updateRes.ok) {
      return { success: false, messages: adminMessages.updateFailed };
    }

    if (updateRes.data?.results?.length === 0) {
      // This means the condition failed (quantityOnHand changed)
      // We could retry, but for simplicity, we'll treat as conflict and ask to retry.
      // In a real system, we might retry a few times.
      return { success: false, messages: adminMessages.updateFailed };
    }

    // Fetch the updated stock to return
    const updatedStockResult = await this.getStock(actor, variantId, branchId);
    if (!updatedStockResult.success) {
      return updatedStockResult;
    }

    // Log a stock movement
    await this.recordStockMovement(
      actor,
      variantId,
      branchId,
      change > 0 ? 'in' : 'out',
      Math.abs(change),
      undefined, // lotId
      referenceType,
      referenceId,
      performedBy,
      note
    );

    return { success: true, updatedStock: sanitizeInventoryStockForAdmin(updatedStockResult.stock) };
  }

  /**
   * Record a stock movement.
   */
  private static async recordStockMovement(
    actor: ActorContext,
    variantId: string,
    branchId: string,
    type: 'in' | 'out' | 'reserve' | 'release',
    quantity: number,
    lotId?: string | null,
    referenceType?: string | null,
    referenceId?: string | null,
    performedBy?: string | null,
    note?: string | null
  ): Promise<void> {
    // We don't need to check permissions for internal logging, but we can if we want.
    // For now, we'll just insert.

    // Get current stock to compute before and after
    const stockResult = await this.getStock(actor, variantId, branchId);
    if (!stockResult.success) {
      // If we can't get stock, we still log but with unknown before/after?
      // For simplicity, we'll skip logging if we can't get stock.
      return;
    }

    const currentStock = stockResult.stock as InventoryStock & { _id: string };
    const quantityBefore = Number(currentStock.quantityOnHand);
    let quantityAfter = quantityBefore;

    if (type === 'in') {
      quantityAfter = quantityBefore + quantity;
    } else if (type === 'out') {
      quantityAfter = quantityBefore - quantity;
    } else if (type === 'reserve') {
      // Reserve doesn't change quantityOnHand, but we might want to track it separately.
      // For simplicity, we'll treat reserve as a movement that doesn't affect on-hand.
      // We'll just log the movement with quantity being the reserved amount.
      quantityAfter = quantityBefore;
    } else if (type === 'release') {
      quantityAfter = quantityBefore;
    }

    const movement: StockMovement = {
      variantId,
      branchId,
      lotId: lotId ?? null,
      type,
      quantity,
      quantityBefore,
      quantityAfter,
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
      performedBy: performedBy ?? null,
      note: note ?? null,
      createdAt: new Date()
    };

    await cbStockMovements.document.insert(
      `${variantId}_${branchId}_${Date.now()}_${Math.random()}`, // simple unique ID
      movement
    );
  }

  // ========== INVENTORY LOTS ==========

  /**
   * List inventory lots for a variant at a branch.
   */
  static async listLots(
    actor: ActorContext,
    options: {
      branchId?: string;
      variantId?: string;
      page?: number;
      pageSize?: number;
      status?: string
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & InventoryLotListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:read');
    if (!scope) return { success: false, messages: adminMessages.permissionDenied };

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (scope === 'own_branch') {
      if (!actor.branchId) {
        return { success: false, messages: adminMessages.permissionDenied };
      }
      conditions.push('branchId = $' + (args.length + 1));
      args.push(actor.branchId);
    }

    if (options.branchId) {
      conditions.push('branchId = $' + (args.length + 1));
      args.push(options.branchId);
    }

    if (options.variantId) {
      conditions.push('variantId = $' + (args.length + 1));
      args.push(options.variantId);
    }

    if (options.status) {
      conditions.push('status = $' + (args.length + 1));
      args.push(options.status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const selectClause = `META().id AS _id, ${INVENTORY_LOT_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')}`;

    const [countRes, dataRes] = await Promise.all([
      cbInventoryLots.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${inventoryLotsKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbInventoryLots.document.query({
        statement: `SELECT ${selectClause} FROM ${inventoryLotsKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: adminMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizeInventoryLotForAdmin);

    return { success: true, items, total, page, pageSize };
  }

  /**
   * Create a new inventory lot.
   */
  static async createLot(
    actor: ActorContext,
    lot: Omit<InventoryLot, '_id'> & { _id?: string }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { createdLot: Record<string, unknown> } )> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:manage');
    if (!scope) return { success: false, messages: adminMessages.permissionDenied };

    if (scope === 'own_branch' && !actor.branchId) {
      return { success: false, messages: adminMessages.permissionDenied };
    }

    if (scope === 'own_branch' && actor.branchId && lot.branchId && actor.branchId !== lot.branchId) {
      return { success: false, messages: adminMessages.permissionDenied };
    }

    // Generate a simple ID if not provided
    const id = lot._id ?? `${lot.variantId}_${lot.branchId}_${lot.lotNumber}_${Date.now()}`;

    const res = await cbInventoryLots.document.insert(id, lot);

    if (!res.ok) {
      return { success: false, messages: adminMessages.queryFailed };
    }

    const createdLot = await this.getLotById(actor, id);
    if (!createdLot.success) {
      return createdLot;
    }

    // Log a stock movement for the received quantity
    if (lot.quantityOnHand > 0) {
      await this.recordStockMovement(
        actor,
        lot.variantId,
        lot.branchId,
        'in',
        lot.quantityOnHand,
        lot.lotNumber, // using lotNumber as lotId for simplicity
        'purchase_order',
        undefined, // referenceId
        actor.userId,
        `Received lot ${lot.lotNumber}`
      );
    }

    return { success: true, createdLot: sanitizeInventoryLotForAdmin(createdLot.lot) };
  }

  /**
   * Get a lot by its ID.
   */
  private static async getLotById(
    actor: ActorContext,
    lotId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { lot: Record<string, unknown> } )> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:read');
    if (!scope) return { success: false, messages: adminMessages.permissionDenied };

    const res = await cbInventoryLots.document.get(lotId);

    if (!res.ok) {
      return { success: false, messages: adminMessages.notFound };
    }

    const lot = res.value as InventoryLot;
    return { success: true, lot: sanitizeInventoryLotForAdmin(lot) };
  }

  // ========== BRANCHES (for inventory context) ==========

  /**
   * List all branches (for inventory filtering).
   */
  static async listBranches(
    actor: ActorContext
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { branches: Record<string, unknown>[] } )> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:read');
    if (!scope) return { success: false, messages: adminMessages.permissionDenied };

    const res = await cbBranches.document.query({
      statement: `SELECT META().id AS _id, ${Object.keys(BranchAdminSafeFields).map(f => `\`${f}\``).join(', ')} FROM ${branchesKeyspace} WHERE status = 'active'`,
      readonly: true
    });

    if (!res.ok) {
      return { success: false, messages: adminMessages.queryFailed };
    }

    const branches = (res.data?.results ?? []).map(branch => {
      // We don't have a sanitize function for branches, but we can create one if needed.
      // For now, we'll just return the raw branch (but we should remove sensitive fields).
      // Let's define a safe field list for branches.
      const BranchAdminSafeFields = {
        name: true,
        address: true,
        managerId: true,
        isWarehouse: true,
        status: true,
        createdAt: true,
        updatedAt: true
      } as const;

      const safe = { _id: branch._id } as Record<string, unknown>;
      for (const field in BranchAdminSafeFields) {
        if (BranchAdminSafeFields[field]) {
          safe[field] = branch[field];
        }
      }
      return safe;
    });

    return { success: true, branches };
  }
}

// Define safe fields for branches (used above)
const BranchAdminSafeFields = {
  name: true,
  address: true,
  managerId: true,
  isWarehouse: true,
  status: true,
  createdAt: true,
  updatedAt: true
} as const;