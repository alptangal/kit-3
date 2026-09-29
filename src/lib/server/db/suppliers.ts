// $lib/server/db/suppliers.ts

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { InferCollection } from '$modules/schema';
import { PermissionChecker } from '$modules/rbac/permission-checker';

const cbSuppliers = cbData('suppliers');
const cbPurchaseOrders = cbData('purchase_orders');

const suppliersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`suppliers\``;
const purchaseOrdersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`purchase_orders\``;

const supplierAdminMessages = {
  notFound: {
    vi: 'Không tìm thấy nhà cung cấp',
    en: 'Supplier not found'
  } as TranslateContent,
  poNotFound: {
    vi: 'Không tìm thấy phiếu nhập hàng',
    en: 'Purchase order not found'
  } as TranslateContent,
  queryFailed: {
    vi: 'Truy vấn thất bại',
    en: 'Query failed'
  } as TranslateContent,
  createFailed: {
    vi: 'Tạo thất bại',
    en: 'Creation failed'
  } as TranslateContent,
  updateFailed: {
    vi: 'Cập nhật thất bại',
    en: 'Update failed'
  } as TranslateContent,
  permissionDenied: {
    vi: 'Bạn không có quyền thực hiện thao tác này',
    en: 'You do not have permission to perform this action'
  } as TranslateContent,
  invalidStatus: {
    vi: 'Trạng thái không hợp lệ',
    en: 'Invalid status'
  } as TranslateContent,
  invalidPOItems: {
    vi: 'Danh sách mục PO không hợp lệ',
    en: 'Invalid PO items'
  } as TranslateContent,
} as const;

const SUPPLIER_ADMIN_SAFE_FIELDS = [
  'name',
  'contactPerson',
  'address',
  'status',
  'createdAt',
  'updatedAt'
] as const;

const PO_ADMIN_SAFE_FIELDS = [
  'poCode',
  'supplierId',
  'branchId',
  'status',
  'items',
  'totalCost',
  'createdBy',
  'approvedBy',
  'expectedAt',
  'receivedAt',
  'createdAt',
  'updatedAt'
] as const;

const VALID_PO_STATUSES = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'] as const;
type POStatus = typeof VALID_PO_STATUSES[number];

function sanitizeSupplierForAdmin(doc: any & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of SUPPLIER_ADMIN_SAFE_FIELDS) {
    safe[field] = doc[field];
  }
  return safe;
}

function sanitizePOForAdmin(doc: any & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of PO_ADMIN_SAFE_FIELDS) {
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

type POItem = {
  variantId: string;
  quantity: number;
  unitCost: number;
  lotNumber?: string;
  expiresAt?: string;
};

export class SupplierService {
  private static async requirePermission(
    actor: ActorContext,
    permissionKey: string,
    targetBranchId?: string | null
  ): Promise<{ success: false; messages: TranslateContent } | null> {
    const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
      branchId: actor.branchId,
      targetBranchId,
      actorUserId: actor.userId
    });
    if (!allowed) return { success: false, messages: supplierAdminMessages.permissionDenied };
    return null;
  }

  // ========== SUPPLIERS ==========

  /**
   * List suppliers.
   */
  static async listSuppliers(
    actor: ActorContext,
    options: {
      status?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & ListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'suppliers:read');
    if (!scope) return { success: false, messages: supplierAdminMessages.permissionDenied };

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (options.status) {
      conditions.push('status = $' + (args.length + 1));
      args.push(options.status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const selectClause = 'META().id AS _id, ' + SUPPLIER_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

    const [countRes, dataRes] = await Promise.all([
      cbSuppliers.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${suppliersKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbSuppliers.document.query({
        statement: `SELECT ${selectClause} FROM ${suppliersKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: supplierAdminMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizeSupplierForAdmin);

    return { success: true, items, total, page, pageSize };
  }

  /**
   * Get a supplier.
   */
  static async getSupplier(
    actor: ActorContext,
    supplierId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { supplier: Record<string, unknown> })> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'suppliers:read');
    if (!scope) return { success: false, messages: supplierAdminMessages.permissionDenied };

    const res = await cbSuppliers.document.get({ documentKey: supplierId });

    if (!res.ok) {
      return { success: false, messages: supplierAdminMessages.notFound };
    }

    const supplier = (res as any).data;
    return { success: true, supplier: sanitizeSupplierForAdmin({...supplier, _id: supplierId}) };
  }

  /**
   * Create a supplier.
   */
  static async createSupplier(
    actor: ActorContext,
    supplierData: {
      name: string;
      contactPerson?: string;
      address?: string;
      status: string;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { supplier: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'suppliers:manage');
    if (permError) return permError;

    const supplierId = `supplier_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const supplier = {
      name: supplierData.name,
      contactPerson: supplierData.contactPerson ?? null,
      address: supplierData.address ?? null,
      status: supplierData.status,
      createdAt: now,
      updatedAt: now
    };

    const createRes = await cbSuppliers.document.create({
      documentKey: supplierId,
      content: supplier
    });

    if (!createRes.ok) {
      return { success: false, messages: supplierAdminMessages.createFailed };
    }

    return { success: true, supplier: sanitizeSupplierForAdmin({...supplier, _id: supplierId}) };
  }

  // ========== PURCHASE ORDERS ==========

  /**
   * List purchase orders.
   */
  static async listPurchaseOrders(
    actor: ActorContext,
    options: {
      branchId?: string;
      supplierId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & ListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'suppliers:read');
    if (!scope) return { success: false, messages: supplierAdminMessages.permissionDenied };

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (scope === 'own_branch') {
      if (!actor.branchId) {
        return { success: false, messages: supplierAdminMessages.permissionDenied };
      }
      conditions.push('branchId = $' + (args.length + 1));
      args.push(actor.branchId);
    }

    if (options.branchId) {
      conditions.push('branchId = $' + (args.length + 1));
      args.push(options.branchId);
    }

    if (options.supplierId) {
      conditions.push('supplierId = $' + (args.length + 1));
      args.push(options.supplierId);
    }

    if (options.status) {
      conditions.push('status = $' + (args.length + 1));
      args.push(options.status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const selectClause = 'META().id AS _id, ' + PO_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

    const [countRes, dataRes] = await Promise.all([
      cbPurchaseOrders.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${purchaseOrdersKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbPurchaseOrders.document.query({
        statement: `SELECT ${selectClause} FROM ${purchaseOrdersKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: supplierAdminMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizePOForAdmin);

    return { success: true, items, total, page, pageSize };
  }

  /**
   * Get a purchase order.
   */
  static async getPurchaseOrder(
    actor: ActorContext,
    poId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { po: Record<string, unknown> })> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'suppliers:read');
    if (!scope) return { success: false, messages: supplierAdminMessages.permissionDenied };

    const res = await cbPurchaseOrders.document.get({ documentKey: poId });

    if (!res.ok) {
      return { success: false, messages: supplierAdminMessages.poNotFound };
    }

    const po = (res as any).data;

    if (scope === 'own_branch' && actor.branchId && po.branchId !== actor.branchId) {
      return { success: false, messages: supplierAdminMessages.permissionDenied };
    }

    return { success: true, po: sanitizePOForAdmin({...po, _id: poId}) };
  }

  /**
   * Create a purchase order.
   */
  static async createPurchaseOrder(
    actor: ActorContext,
    poData: {
      poCode: string;
      supplierId: string;
      branchId: string;
      items: POItem[];
      totalCost: number;
      expectedAt: string;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { po: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'suppliers:manage', poData.branchId);
    if (permError) return permError;

    if (!poData.items || poData.items.length === 0) {
      return { success: false, messages: supplierAdminMessages.invalidPOItems };
    }

    const poId = `${poData.branchId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const po = {
      poCode: poData.poCode,
      supplierId: poData.supplierId,
      branchId: poData.branchId,
      status: 'draft' as POStatus,
      items: poData.items,
      totalCost: poData.totalCost,
      createdBy: actor.userId,
      approvedBy: null,
      expectedAt: poData.expectedAt,
      receivedAt: null,
      createdAt: now,
      updatedAt: now
    };

    const createRes = await cbPurchaseOrders.document.create({
      documentKey: poId,
      content: po
    });

    if (!createRes.ok) {
      return { success: false, messages: supplierAdminMessages.createFailed };
    }

    return { success: true, po: sanitizePOForAdmin({...po, _id: poId}) };
  }

  /**
   * Update PO status.
   */
  static async updatePOStatus(
    actor: ActorContext,
    poId: string,
    newStatus: POStatus,
    approvedBy?: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { po: Record<string, unknown> })> {
    if (!VALID_PO_STATUSES.includes(newStatus as any)) {
      return { success: false, messages: supplierAdminMessages.invalidStatus };
    }

    const permError = await this.requirePermission(actor, 'suppliers:manage');
    if (permError) return permError;

    const getRes = await cbPurchaseOrders.document.get({ documentKey: poId });
    if (!getRes.ok) {
      return { success: false, messages: supplierAdminMessages.poNotFound };
    }

    const po = (getRes as any).data;

    if (actor.branchId && po.branchId !== actor.branchId) {
      const scope = await PermissionChecker.getScope(actor.roleName, 'suppliers:manage');
      if (scope === 'own_branch') {
        return { success: false, messages: supplierAdminMessages.permissionDenied };
      }
    }

    const now = new Date().toISOString();
    const updateData: any = {
      ...po,
      status: newStatus,
      updatedAt: now
    };

    if (approvedBy && (newStatus === 'ordered' || newStatus === 'received')) {
      updateData.approvedBy = approvedBy;
    }

    if (newStatus === 'received') {
      updateData.receivedAt = now;
    }

    const updateRes = await cbPurchaseOrders.document.update({
      documentKey: poId,
      content: updateData
    });

    if (!updateRes.ok) {
      return { success: false, messages: supplierAdminMessages.updateFailed };
    }

    const updatedPO = (updateRes as any).data;
    return { success: true, po: sanitizePOForAdmin({...updatedPO, _id: poId}) };
  }
}
