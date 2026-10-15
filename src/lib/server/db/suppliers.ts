// $lib/server/db/suppliers.ts

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { InferCollection } from '$modules/schema';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { InventoryService } from './inventory';
import { AnalyticsService } from './analytics';

const cbSuppliers = cbData('suppliers');
const cbPurchaseOrders = cbData('purchase_orders');
const cbVariants = cbData('product_variants');
const cbCategories = cbData('categories');
const cbInventoryStock = cbData('inventory_stock');
const cbInventoryLots = cbData('inventory_lots');
const cbStockMovementsRef = cbData('stock_movements');

const suppliersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`suppliers\``;
const purchaseOrdersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`purchase_orders\``;
const variantsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`product_variants\``;
const categoriesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`categories\``;
const inventoryStockKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`inventory_stock\``;
const inventoryLotsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`inventory_lots\``;

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
  poNotReceivable: {
    vi: 'Phiếu nhập không ở trạng thái có thể nhận hàng',
    en: 'Purchase order is not in a receivable state'
  } as TranslateContent,
  invalidQuickPurchase: {
    vi: 'Thông tin phiếu nhập nhanh không hợp lệ',
    en: 'Invalid quick purchase data'
  } as TranslateContent,
  invalidMode: {
    vi: 'Kiểu nhập hàng không hợp lệ',
    en: 'Invalid purchase mode'
  } as TranslateContent,
  invalidReceiptImages: {
    vi: 'Ảnh hóa đơn không hợp lệ (tối đa 5 ảnh)',
    en: 'Invalid receipt images (max 5)'
  } as TranslateContent,
  invalidExpiryDates: {
    vi: 'Ngày sản xuất / hạn sử dụng không hợp lệ',
    en: 'Invalid manufactured / expiry dates'
  } as TranslateContent,
  receiveFailed: {
    vi: 'Nhận hàng thất bại',
    en: 'Failed to receive purchase order'
  } as TranslateContent,
  categoryNotFound: {
    vi: 'Không tìm thấy thể loại',
    en: 'Category not found'
  } as TranslateContent,
  variantNotFound: {
    vi: 'Không tìm thấy sản phẩm trong phiếu',
    en: 'Variant not found in purchase'
  } as TranslateContent,
  invalidVoucher: {
    vi: 'Thông tin khuyến mãi nhập hàng không hợp lệ',
    en: 'Invalid purchase voucher data'
  } as TranslateContent,
  giftVariantNotFound: {
    vi: 'Không tìm thấy sản phẩm quà tặng trong phiếu',
    en: 'Gift variant not found in purchase'
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
  'vouchers',
  'createdBy',
  'approvedBy',
  'expectedAt',
  'receivedAt',
  'source',
  'note',
  'categoryId',
  'createdAt',
  'updatedAt'
] as const;

// Ảnh hóa đơn chỉ trả qua get (không trả trong list — payload lớn)
type ReceiptImageDoc = { _id: string; receiptImages?: string[] };

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

// ActorContext dùng chung từ users.ts — export lại để tương thích import cũ từ file này.
import type { ActorContext } from './users';
export type { ActorContext };

type POItem = {
  variantId: string;
  quantity: number;
  unitCost: number;
  lotNumber?: string;
  expiresAt?: string;
  // NSX per-item (mỗi dòng có thể có ngày sản xuất riêng — nhập hàng thực tế
  // mỗi dòng 1 lô NSX khác nhau); rỗng → dùng expiry chung của phiếu.
  manufacturedAt?: string;
  // Giá vốn hiệu dụng sau phân bổ voucher (tổng tiền thực trả / tổng đơn vị thực nhận
  // kể cả quà tặng) — xem applyVoucherCostAllocation.
  unitCostEffective?: number;
  // Voucher nhập hàng từ NCC (khuyến mãi gắn 1 dòng nhập): 'money' giảm tiền,
  // 'gift' tặng thêm hàng. Optional — phiếu cũ không có field này vẫn chạy như cũ.
  voucher?: PurchaseVoucher;
};

/**
 * Voucher nhập hàng (khuyến mãi TỪ NCC khi nhập — KHÔNG phải khuyến mãi bán hàng):
 * - type 'money': giảm tiền trên dòng nhập (value = số tiền giảm, >= 0).
 * - type 'gift': tặng thêm hàng (giftVariantId + giftQuantity > 0) — khi receive
 *   sẽ CỘNG TỒN thêm cho variant quà (quà = hàng nhận thật, giá vốn 0 đồng phần quà).
 */
export type PurchaseVoucher =
  | { type: 'money'; value: number; note?: string }
  | { type: 'gift'; giftVariantId: string; giftQuantity: number; note?: string };

type QuickPurchaseMode = 'supplier' | 'product' | 'category';

type QuickPurchaseItem = {
  variantId: string;
  quantity: number;
  unitCost: number;
  lotNumber?: string;
  expiresAt?: string;
  manufacturedAt?: string;
  voucher?: PurchaseVoucher;
};

export type QuickPurchaseInput = {
  mode: QuickPurchaseMode;
  supplierId?: string;
  categoryId?: string;
  branchId: string;
  items: QuickPurchaseItem[];
  totalCost: number;
  receiptImages?: string[];
  note?: string;
  // Voucher giảm tiền cấp PHIEU (giảm trên tổng đơn nhập, độc lập voucher từng dòng).
  vouchers?: PurchaseVoucher[];
  // expiryMode: nhập trực tiếp ISO hoặc theo số ngày
  expiryMode?: 'direct' | 'days';
  manufacturedAt?: string;
  expiresAt?: string;
  manufacturedDaysAgo?: number;
  expiresInDays?: number;
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
      // Mặc định 'order' — phiếu tạo qua luồng PO duyệt trước
      source: 'order' as string,
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

  /**
   * Get a purchase order including receiptImages (payload lớn — chỉ endpoint get dùng).
   */
  static async getPurchaseOrderWithImages(
    actor: ActorContext,
    poId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { po: Record<string, unknown> & ReceiptImageDoc })> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'purchases:read');
    if (!scope) return { success: false, messages: supplierAdminMessages.permissionDenied };

    const res = await cbPurchaseOrders.document.get({ documentKey: poId });

    if (!res.ok) {
      return { success: false, messages: supplierAdminMessages.poNotFound };
    }

    const po = (res as any).data;

    if (scope === 'own_branch' && actor.branchId && po.branchId !== actor.branchId) {
      return { success: false, messages: supplierAdminMessages.permissionDenied };
    }

    const poWithImages = sanitizePOForAdmin({ ...po, _id: poId }) as Record<string, unknown> & ReceiptImageDoc;
    poWithImages.receiptImages = Array.isArray(po.receiptImages) ? po.receiptImages : [];

    return { success: true, po: poWithImages };
  }

  // ========== NHẬN HÀNG + NHẬP NHANH ==========

  /**
   * Tạo inventory lot cho 1 dòng nhận hàng + cộng tồn kho.
   *
   * QUYẾT ĐỊNH KIẾN TRÚC (đã khảo sát InventoryService):
   * - createLot() CHỈ tạo doc inventory_lots + log stock movement — KHÔNG cộng inventory_stock.
   * - adjustStock() yêu cầu doc inventory_stock đã tồn tại (getStock → notFound nếu chưa có).
   * → Flow chuẩn: tạo lot qua cbInventoryLots trực tiếp (tránh double movement log của createLot),
   *   sau đó đảm bảo doc inventory_stock tồn tại (upsert) rồi mới cộng số dư theo N1QL điều kiện.
   * Luôn tạo lot kể cả variant không trackLot (lotNumber tự sinh) — thống nhất truy vết nguồn gốc.
   */
  private static async receiveItemToStock(params: {
    actor: ActorContext;
    poId: string;
    poCode: string;
    item: { variantId: string; quantity: number; lotNumber?: string; manufacturedAt?: string | null; expiresAt?: string | null };
    branchId: string;
    supplierId: string;
    now: string;
  }): Promise<boolean> {
    const { actor, poId, poCode, item, branchId, supplierId, now } = params;

    const lotNumber = item.lotNumber?.trim() || `${poCode}_${Date.now()}`;
    const lotId = `${item.variantId}_${branchId}_${lotNumber}_${Date.now()}`;

    const lot = {
      variantId: item.variantId,
      branchId,
      lotNumber,
      quantityOnHand: item.quantity,
      manufacturedAt: item.manufacturedAt ?? null,
      expiresAt: item.expiresAt ?? null,
      receivedAt: now,
      supplierId,
      status: 'active',
      createdAt: now
    };

    const createRes = await cbInventoryLots.document.create({
      documentKey: lotId,
      content: lot
    });
    if (!createRes.ok) return false;

    // Stock movement 'receive' gắn referenceType purchase_order (truy vết về PO)
    await cbStockMovementsRef.document.create({
      documentKey: `${item.variantId}_${branchId}_${Date.now()}_rcv${Math.random().toString(36).substring(2, 6)}`,
      content: {
        variantId: item.variantId,
        branchId,
        lotId: lotId,
        type: 'receive',
        quantity: item.quantity,
        quantityBefore: null,
        quantityAfter: null,
        referenceType: 'purchase_order',
        referenceId: poId,
        performedBy: actor.userId,
        note: `Received via ${poCode}`,
        createdAt: now
      }
    });

    // Cộng inventory_stock: đảm bảo doc tồn tại trước (upsert khi chưa có)
    const getStockRes = await cbInventoryStock.document.get({ documentKey: `stock_${item.variantId}_${branchId}` });
    if (!getStockRes.ok) {
      await cbInventoryStock.document.create({
        documentKey: `stock_${item.variantId}_${branchId}`,
        content: {
          variantId: item.variantId,
          branchId,
          quantityOnHand: item.quantity,
          quantityReserved: 0,
          updatedAt: now
        }
      });
      return true;
    }

    // Đã có doc → cộng dồn bằng N1QL (điều kiện đọc-lại số cũ chống race)
    const incRes = await cbInventoryStock.document.query({
      statement: `
        UPDATE ${inventoryStockKeyspace}
        SET quantityOnHand = quantityOnHand + $3, updatedAt = $4
        WHERE META().id = $1 AND variantId = $2
      `,
      args: [`stock_${item.variantId}_${branchId}`, item.variantId, item.quantity, now],
      readonly: false
    });
    if (!incRes.ok) return false;

    return true;
  }

  /**
   * Nhận hàng cho PO: set status='received' + tạo lot + cộng kho cho từng item.
   * Chỉ cho phép nhận khi status là 'ordered' hoặc 'partially_received'.
   */
  static async receivePurchaseOrder(
    actor: ActorContext,
    poId: string,
    receivedItems?: Array<{ variantId: string; quantity: number; lotNumber?: string; manufacturedAt?: string | null; expiresAt?: string | null }>
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { po: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'purchases:manage');
    if (permError) return permError;

    const getRes = await cbPurchaseOrders.document.get({ documentKey: poId });
    if (!getRes.ok) {
      return { success: false, messages: supplierAdminMessages.poNotFound };
    }

    const po = (getRes as any).data;

    if (actor.branchId && po.branchId !== actor.branchId) {
      const scope = await PermissionChecker.getScope(actor.roleName, 'purchases:manage');
      if (scope === 'own_branch') {
        return { success: false, messages: supplierAdminMessages.permissionDenied };
      }
    }

    if (po.status !== 'ordered' && po.status !== 'partially_received') {
      return { success: false, messages: supplierAdminMessages.poNotReceivable };
    }

    const now = new Date().toISOString();
    const items: POItem[] = Array.isArray(po.items) ? po.items : [];
    const overrides = Array.isArray(receivedItems) ? receivedItems : [];

    let allOk = true;
    for (const item of items) {
      const override = overrides.find((o) => o.variantId === item.variantId);
      const merged = {
        variantId: item.variantId,
        quantity: Number(override?.quantity ?? item.quantity) || 0,
        lotNumber: override?.lotNumber ?? item.lotNumber,
        manufacturedAt: override?.manufacturedAt ?? null,
        expiresAt: override?.expiresAt ?? item.expiresAt ?? null
      };
      if (merged.quantity <= 0) continue;
      const ok = await this.receiveItemToStock({
        actor,
        poId,
        poCode: po.poCode ?? poId,
        item: merged,
        branchId: po.branchId,
        supplierId: po.supplierId,
        now
      });
      if (!ok) allOk = false;

      // Quà tặng từ voucher dòng nhập (PO truyền thống cũng hỗ trợ) — cộng tồn kho quà
      if (item.voucher?.type === 'gift') {
        const giftQty = Number(item.voucher.giftQuantity) || 0;
        if (giftQty > 0) {
          const giftOk = await this.receiveItemToStock({
            actor,
            poId,
            poCode: po.poCode ?? poId,
            item: {
              variantId: item.voucher.giftVariantId,
              quantity: giftQty,
              lotNumber: merged.lotNumber ? `${merged.lotNumber}-gift` : undefined,
              manufacturedAt: merged.manufacturedAt,
              expiresAt: merged.expiresAt
            },
            branchId: po.branchId,
            supplierId: po.supplierId,
            now
          });
          if (!giftOk) allOk = false;
        }
      }
    }

    // Update status PO sang received kèm receivedAt
    const updateRes = await cbPurchaseOrders.document.update({
      documentKey: poId,
      content: {
        ...po,
        status: 'received' as POStatus,
        approvedBy: po.approvedBy ?? actor.userId,
        receivedAt: now,
        updatedAt: now
      }
    });

    if (!updateRes.ok) {
      return { success: false, messages: supplierAdminMessages.updateFailed };
    }

    if (!allOk) {
      // PO vẫn đánh dấu received nhưng có lot/kho tạo lỗi — báo success kèm cảnh báo qua log
      console.warn(`[SupplierService.receivePurchaseOrder] partial failure creating lots for PO ${poId}`);
    }

    const updatedPO = (updateRes as any).data;
    // Hook analytics: ghi lịch sử giá nhập (best-effort, không ảnh hưởng kết quả nhận hàng)
    void AnalyticsService.recordFromPurchase(
      actor,
      items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitCost: Number(i.unitCost) || 0 })),
      'purchase_order',
      poId,
      po.branchId
    ).catch(() => {});
    return { success: true, po: sanitizePOForAdmin({...updatedPO, _id: poId}) };
  }

  /**
   * Validate voucher nhập hàng (khuyến mãi từ NCC). Trả null nếu hợp lệ, ngược lại
   * trả message lỗi tương ứng. Voucher là optional — undefined luôn hợp lệ.
   * - 'money': value phải là số >= 0.
   * - 'gift': giftVariantId bắt buộc + giftQuantity > 0; variant quà phải tồn tại
   *   (nếu không tồn tại thì phiếu nhập sẽ cộng kho cho hàng không có thật).
   */
  private static async validatePurchaseVoucher(
    voucher: PurchaseVoucher | undefined,
    lang?: 'vi' | 'en'
  ): Promise<TranslateContent | null> {
    if (voucher == null) return null;
    if (typeof voucher !== 'object' || (voucher.type !== 'money' && voucher.type !== 'gift')) {
      return supplierAdminMessages.invalidVoucher;
    }
    if (voucher.type === 'money') {
      const v = Number(voucher.value);
      if (!Number.isFinite(v) || v < 0) return supplierAdminMessages.invalidVoucher;
      return null;
    }
    const giftQty = Number((voucher as { giftQuantity?: unknown }).giftQuantity);
    const giftVariantId = (voucher as { giftVariantId?: unknown }).giftVariantId;
    if (!giftVariantId || typeof giftVariantId !== 'string' || !Number.isFinite(giftQty) || giftQty <= 0) {
      return supplierAdminMessages.invalidVoucher;
    }
    const giftRes = await cbVariants.document.get({ documentKey: giftVariantId });
    if (!giftRes.ok) return supplierAdminMessages.giftVariantNotFound;
    void lang;
    return null;
  }

  /**
   * Phân bổ giá vốn voucher cho các dòng nhập (tính unitCostEffective).
   *
   * RATIONALE (giá vốn sau khuyến mãi nhập hàng):
   * - Tổng tiền thực trả effectiveCost = totalCost − Σ voucher 'money' (item + phiếu).
   *   Phần giảm tiền do NCC chịu → không nằm trong giá vốn hàng nhập.
   * - Quà tặng ('gift') là hàng nhận THẬT với giá vốn 0 đồng phần được tặng: tổng
   *   đơn vị thực nhận toàn phiếu = Σ(quantity + giftQuantity của từng dòng).
   * - effectiveCost chia ĐỀU theo tổng đơn vị thực nhận toàn phiếu (đơn giản,
   *   deterministic, tổng unitCostEffective × tổng SL đúng bằng tiền thực trả —
   *   không theo tỷ trọng giá trị để tránh sai số làm tròn lũy kế phức tạp).
   * - Round 4 chữ số thập phân.
   */
  private static applyVoucherCostAllocation(
    items: POItem[],
    totalCost: number,
    poVouchers: PurchaseVoucher[]
  ): POItem[] {
    const moneyItem = items.reduce(
      (s, it) => s + (it.voucher?.type === 'money' ? Number(it.voucher.value) || 0 : 0),
      0
    );
    const moneyPO = poVouchers.reduce(
      (s, v) => s + (v.type === 'money' ? Number(v.value) || 0 : 0),
      0
    );
    const effectiveCost = Math.max(0, (Number(totalCost) || 0) - moneyItem - moneyPO);

    // Tổng đơn vị thực nhận (kể cả quà tặng)
    let totalUnits = 0;
    for (const it of items) {
      const giftQty = it.voucher?.type === 'gift' ? Number(it.voucher.giftQuantity) || 0 : 0;
      totalUnits += it.quantity + giftQty;
    }

    if (totalUnits <= 0 || effectiveCost <= 0) {
      // Không có gì để phân bổ — giữ nguyên giá gốc (phiếu cũ không voucher)
      return items.map((it) => ({ ...it, unitCostEffective: it.unitCost }));
    }

    const perUnit = Math.round((effectiveCost / totalUnits) * 10000) / 10000;
    return items.map((it) => ({ ...it, unitCostEffective: perUnit }));
  }

  /**
   * Tính manufacturedAt/expiresAt theo expiryMode:
   * - 'direct': dùng ngày client gửi (ISO).
   * - 'days': manufacturedAt = now − manufacturedDaysAgo; expiresAt = manufacturedAt + expiresInDays
   *   (hoặc expiresAt = now + expiresInDays nếu không có manufactured).
   */
  private static resolveQuickExpiry(input: QuickPurchaseInput): { manufacturedAt: string | null; expiresAt: string | null } | null {
    const mode = input.expiryMode ?? 'direct';
    if (mode === 'days') {
      const mDays = Number(input.manufacturedDaysAgo ?? 0);
      const eDays = Number(input.expiresInDays ?? 0);
      if (!Number.isFinite(mDays) || !Number.isFinite(eDays) || eDays <= 0) return null;
      const manufactured = new Date(Date.now() - mDays * 24 * 60 * 60 * 1000);
      const base = input.manufacturedDaysAgo != null && mDays >= 0 ? manufactured : new Date();
      const expires = new Date(base.getTime() + eDays * 24 * 60 * 60 * 1000);
      return { manufacturedAt: manufactured.toISOString(), expiresAt: expires.toISOString() };
    }
    // direct
    const m = input.manufacturedAt ? new Date(input.manufacturedAt) : null;
    const e = input.expiresAt ? new Date(input.expiresAt) : null;
    if (m && isNaN(m.getTime())) return null;
    if (e && isNaN(e.getTime())) return null;
    if (m && e && e.getTime() <= m.getTime()) return null;
    return {
      manufacturedAt: m ? m.toISOString() : null,
      expiresAt: e ? e.toISOString() : null
    };
  }

  /**
   * Nhập nhanh đa kiểu — KHÔNG qua PO duyệt trước:
   * - mode 'supplier': nhập theo NCC đã chọn.
   * - mode 'product': nhập thẳng 1-nhiều variant.
   * - mode 'category': chọn category — server xác thực category tồn tại, items đã lọc sẵn phía UI.
   *
   * Tạo purchase_orders doc với status='received' ngay + source='quick' + receiptImages,
   * rồi chạy luôn receive flow (tạo lot + cộng kho).
   */
  static async createQuickPurchase(
    actor: ActorContext,
    input: QuickPurchaseInput
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { po: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'purchases:manage', input.branchId);
    if (permError) return permError;

    if (!['supplier', 'product', 'category'].includes(input.mode)) {
      return { success: false, messages: supplierAdminMessages.invalidMode };
    }

    if (!input.items || input.items.length === 0) {
      return { success: false, messages: supplierAdminMessages.invalidQuickPurchase };
    }

    for (const item of input.items) {
      if (!item.variantId || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || !Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) < 0) {
        return { success: false, messages: supplierAdminMessages.invalidQuickPurchase };
      }
      // Voucher từng dòng (optional) — validate shape + variant quà tồn tại
      const voucherError = await this.validatePurchaseVoucher(item.voucher);
      if (voucherError) return { success: false, messages: voucherError };
    }

    // Voucher cấp phiếu (optional) — validate shape + variant quà tồn tại
    if (input.vouchers != null) {
      if (!Array.isArray(input.vouchers)) return { success: false, messages: supplierAdminMessages.invalidVoucher };
      for (const v of input.vouchers) {
        const voucherError = await this.validatePurchaseVoucher(v);
        if (voucherError) return { success: false, messages: voucherError };
      }
    }

    // mode 'supplier' bắt buộc có supplierId
    if (input.mode === 'supplier' && !input.supplierId) {
      return { success: false, messages: supplierAdminMessages.invalidQuickPurchase };
    }

    // mode 'category' — xác thực category tồn tại
    if (input.mode === 'category' && input.categoryId) {
      const catRes = await cbCategories.document.get({ documentKey: input.categoryId });
      if (!catRes.ok) {
        return { success: false, messages: supplierAdminMessages.categoryNotFound };
      }
    }

    // receiptImages: base64 data URL, tối đa 5
    if (input.receiptImages != null) {
      if (!Array.isArray(input.receiptImages) || input.receiptImages.length > 5) {
        return { success: false, messages: supplierAdminMessages.invalidReceiptImages };
      }
      for (const img of input.receiptImages) {
        if (typeof img !== 'string' || !img.startsWith('data:image/')) {
          return { success: false, messages: supplierAdminMessages.invalidReceiptImages };
        }
      }
    }

    // Tính hạn sử dụng
    const expiry = this.resolveQuickExpiry(input);
    if (!expiry) {
      return { success: false, messages: supplierAdminMessages.invalidExpiryDates };
    }

    const now = new Date().toISOString();
    const poCode = `QN-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const poId = `${input.branchId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const items: POItem[] = input.items.map((item) => ({
      variantId: item.variantId,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      lotNumber: item.lotNumber?.trim() || undefined,
      expiresAt: item.expiresAt || expiry.expiresAt || undefined,
      manufacturedAt: item.manufacturedAt || expiry.manufacturedAt || undefined,
      voucher: item.voucher ?? undefined
    }));

    // Voucher cấp phiếu: giảm tiền tổng đơn (khuyến mãi từ NCC)
    const poVouchers: PurchaseVoucher[] = (input.vouchers ?? []).filter((v) => v != null);

    // Phân bổ giá vốn sau voucher (unitCostEffective)
    const allocatedItems = this.applyVoucherCostAllocation(items, Number(input.totalCost) || 0, poVouchers);

    const po = {
      poCode,
      supplierId: input.supplierId ?? null,
      branchId: input.branchId,
      status: 'received' as POStatus,
      items: allocatedItems,
      totalCost: Number(input.totalCost) || items.reduce((s, it) => s + it.quantity * it.unitCost, 0),
      vouchers: poVouchers.length > 0 ? poVouchers : undefined,
      createdBy: actor.userId,
      approvedBy: actor.userId,
      expectedAt: now,
      receivedAt: now,
      source: 'quick' as string,
      note: input.note?.trim() || null,
      // mode 'category': lưu category gốc để list lọc "nhập theo thể loại"
      categoryId: input.categoryId ?? null,
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

    // Lưu ảnh hóa đơn (nếu có) — tách khỏi doc chính để list không kéo payload lớn
    if (input.receiptImages && input.receiptImages.length > 0) {
      await cbPurchaseOrders.document.update({
        documentKey: poId,
        content: { ...po, receiptImages: input.receiptImages, updatedAt: now }
      });
    }

    // Chạy receive flow: tạo lot + cộng kho cho từng item (NSX per-item nếu có),
    // cộng thêm tồn kho quà tặng (voucher 'gift' = hàng nhận thật từ NCC —
    // tạo lot + stock movement riêng cho phần quà).
    let allOk = true;
    for (const item of allocatedItems) {
      const ok = await this.receiveItemToStock({
        actor,
        poId,
        poCode,
        item: {
          variantId: item.variantId,
          quantity: item.quantity,
          lotNumber: item.lotNumber,
          manufacturedAt: item.manufacturedAt || expiry.manufacturedAt,
          expiresAt: item.expiresAt || expiry.expiresAt
        },
        branchId: input.branchId,
        supplierId: po.supplierId ?? '',
        now
      });
      if (!ok) allOk = false;

      // Quà tặng: cộng tồn kho cho variant quà (lot riêng suffix '-gift')
      if (item.voucher?.type === 'gift') {
        const giftQty = Number(item.voucher.giftQuantity) || 0;
        if (giftQty > 0) {
          const giftOk = await this.receiveItemToStock({
            actor,
            poId,
            poCode,
            item: {
              variantId: item.voucher.giftVariantId,
              quantity: giftQty,
              lotNumber: item.lotNumber ? `${item.lotNumber}-gift` : undefined,
              manufacturedAt: item.manufacturedAt || expiry.manufacturedAt,
              expiresAt: item.expiresAt || expiry.expiresAt
            },
            branchId: input.branchId,
            supplierId: po.supplierId ?? '',
            now
          });
          if (!giftOk) allOk = false;
        }
      }
    }

    if (!allOk) {
      console.warn(`[SupplierService.createQuickPurchase] partial failure creating lots for quick purchase ${poId}`);
    }

    // Hook analytics: ghi lịch sử giá nhập (best-effort, không ảnh hưởng kết quả nhập nhanh)
    void AnalyticsService.recordFromPurchase(
      actor,
      items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitCost: i.unitCost })),
      'quick_purchase',
      poId,
      input.branchId
    ).catch(() => {});

    return { success: true, po: sanitizePOForAdmin({...po, _id: poId}) };
  }

  /**
   * Danh sách phiếu nhập cho trang /admin/purchases — dùng permission 'purchases:read'
   * (khác listPurchaseOrders dùng 'suppliers:read' cho trang suppliers).
   * Filter: branch / supplier / category / source ('quick'|'order') / status /
   * khoảng thời gian theo receivedAt.
   */
  static async listPurchases(
    actor: ActorContext,
    options: {
      branchId?: string;
      supplierId?: string;
      categoryId?: string;
      source?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & ListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'purchases:read');
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
    if (options.categoryId) {
      conditions.push('categoryId = $' + (args.length + 1));
      args.push(options.categoryId);
    }
    if (options.source) {
      conditions.push('source = $' + (args.length + 1));
      args.push(options.source);
    }
    if (options.status) {
      conditions.push('status = $' + (args.length + 1));
      args.push(options.status);
    }
    if (options.dateFrom) {
      conditions.push('receivedAt >= $' + (args.length + 1));
      args.push(options.dateFrom);
    }
    if (options.dateTo) {
      conditions.push('receivedAt <= $' + (args.length + 1));
      args.push(options.dateTo);
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
        statement: `SELECT ${selectClause} FROM ${purchaseOrdersKeyspace} ${whereClause} ORDER BY createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
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
}
