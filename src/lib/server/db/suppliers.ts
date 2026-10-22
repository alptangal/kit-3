// $lib/server/db/suppliers.ts

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { InferCollection } from '$modules/schema';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { InventoryService } from './inventory';
import { AnalyticsService } from './analytics';
import { SerialService } from './serials';

const cbSuppliers = cbData('suppliers');
const cbSupplierHistories = cbData('supplier_histories');
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

// LIKE trong N1QL layer này case-sensitive + diacritic-sensitive ("SON" không
// match "Sơn", "sơn" không match "Sơn lan tạp hoá") — thay bằng
// REGEXP_CONTAINS với class ký tự mở rộng: 'o' → class chứa o/ô/ơ + mọi biến
// thể dấu, HOA + thường (thực nghiệm: flag (?i) KHÔNG ổn định với class chứa
// ký tự hoa unicode — đôi lúc làm chết pattern → tự lo case bằng class).
// "son"/"sơn"/"SON" đều match "Sơn lan tạp hoá".
const DIACRITIC_CLASSES: Record<string, string> = {
  a: 'aàáảãạăằắẳẵặâầấẩẫậAÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ',
  e: 'eèéẻẽẹêềếểễệEÈÉẺẼẸÊỀẾỂỄỆ',
  i: 'iìíỉĩịIÌÍỈĨỊ',
  o: 'oòóỏõọôồốổỗộơờớởỡợOÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ',
  u: 'uùúủũụưừứửữựUÙÚỦŨỤƯỪỨỬỮỰ',
  y: 'yỳýỷỹỵYỲÝỶỸỴ',
  d: 'dđDĐ'
};
function buildDiacriticInsensitiveRegex(term: string): string {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = '';
  for (const ch of escaped) {
    // Ký tự có dấu (VD 'ơ') → base (NFD strip marks) → class mở rộng
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const cls = DIACRITIC_CLASSES[base];
    if (cls) {
      out += `[${cls}]`;
    } else if (/[a-zA-Z]/.test(ch)) {
      // Chữ ASCII — class hoa + thường (không dựa (?i))
      out += `[${ch.toLowerCase()}${ch.toUpperCase()}]`;
    } else {
      out += ch;
    }
  }
  return out;
}

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
  invalidInput: {
    vi: 'Dữ liệu không hợp lệ',
    en: 'Invalid data'
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
  historyNotFound: {
    vi: 'Không tìm thấy bản ghi lịch sử',
    en: 'History entry not found'
  } as TranslateContent,
  historyQueryFailed: {
    vi: 'Truy vấn lịch sử thất bại',
    en: 'Failed to query history'
  } as TranslateContent,
  restoreNoChanges: {
    vi: 'Không có gì để khôi phục (dữ liệu hiện tại trùng với thời điểm đó)',
    en: 'Nothing to restore (current data already matches that point)'
  } as TranslateContent,
  restoreFailed: {
    vi: 'Khôi phục thất bại',
    en: 'Restore failed'
  } as TranslateContent,
} as const;

const SUPPLIER_ADMIN_SAFE_FIELDS = [
  'name',
  'contactPerson',
  'address',
  'ward',
  'district',
  'province',
  'country',
  'phones',
  'emails',
  'addresses',
  'zalo',
  'facebook',
  'telegram',
  'discord',
  'avatarUrl',
  'images',
  'note',
  'status',
  'createdAt',
  'updatedAt'
] as const;

// Field dạng mảng (phones/emails/images) — validate phần tử string trước khi ghi
const SUPPLIER_ARRAY_FIELDS = ['phones', 'emails', 'images'] as const;

// Mảng addresses: phần tử là object {label?, address, ward?, district?, province?, country?}
const SUPPLIER_ADDRESS_ENTRY_FIELDS = ['label', 'address', 'ward', 'district', 'province', 'country'] as const;

function sanitizeAddressEntries(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => {
      const out: Record<string, string> = {};
      for (const field of SUPPLIER_ADDRESS_ENTRY_FIELDS) {
        const v = (entry as Record<string, unknown>)[field];
        if (typeof v === 'string' && v.trim()) out[field] = v.trim();
      }
      return out;
    })
    // Bỏ entry rỗng hoàn toàn (trường hợp user xoá text nhưng để block trống)
    .filter((entry) => Object.keys(entry).length > 0);
}

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

// ── Timeline lịch sử thay đổi supplier (kiểu git: diff từng trường + restore) ──

export interface SupplierHistoryChange {
  field: string;
  before: string | null;
  after: string | null;
}

export interface SupplierHistoryEntry {
  _id: string;
  supplierId: string;
  type: 'update' | 'restore';
  actorId: string;
  actorName?: string | null;
  createdAt: string;
  changes: SupplierHistoryChange[];
}

// Trường theo dõi diff (không gồm createdAt/updatedAt — metadata thời gian không đưa vào timeline)
const SUPPLIER_HISTORY_FIELDS = [
  'name', 'contactPerson', 'address', 'ward', 'district', 'province', 'country',
  'phones', 'emails', 'addresses', 'zalo', 'facebook', 'telegram', 'discord',
  'avatarUrl', 'images', 'note', 'status'
] as const;

const supplierHistoriesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`supplier_histories\``;
const MAX_HISTORY_PER_SUPPLIER = 100;

/** So sánh 2 giá trị bất kỳ qua JSON string — undefined/null rỗng gộp về null cho gọn. */
function snapshotValue(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function buildHistoryChanges(
  beforeDoc: Record<string, unknown>,
  afterDoc: Record<string, unknown>
): SupplierHistoryChange[] {
  const changes: SupplierHistoryChange[] = [];
  for (const field of SUPPLIER_HISTORY_FIELDS) {
    const b = snapshotValue(beforeDoc[field]);
    const a = snapshotValue(afterDoc[field]);
    if (b !== a) changes.push({ field, before: b, after: a });
  }
  return changes;
}

/**
 * Ghi 1 entry lịch sử sau khi update/restore THÀNH CÔNG.
 * Fire-and-forget an toàn: lỗi ghi history KHÔNG làm fail update (chỉ log).
 * Prune khi vượt MAX_HISTORY_PER_SUPPLIER (xoá entry cũ nhất — restore KHÔNG xoá,
 * chỉ giới hạn dung lượng collection).
 */
async function recordSupplierHistory(
  supplierId: string,
  type: 'update' | 'restore',
  actor: ActorContext,
  changes: SupplierHistoryChange[]
): Promise<void> {
  if (changes.length === 0) return;
  try {
    const actorName = await resolveActorName(actor.userId);
    const at = new Date().toISOString();
    const historyId = `suphist_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const createRes = await cbSupplierHistories.document.create({
      documentKey: historyId,
      content: {
        supplierId,
        type,
        actorId: actor.userId,
        actorName: actorName ?? null,
        createdAt: at,
        changes
      }
    });
    if (!createRes.ok) {
      console.error('[recordSupplierHistory] create failed', createRes.status, createRes.message);
      return;
    }
    // Prune cũ nhất khi vượt cap
    const listRes = await cbSupplierHistories.query.document.search({
      conditions: [{ fieldName: 'supplierId', keyword: supplierId }],
      limit: 1000
    });
    if (listRes.ok) {
      const rows = ((listRes.data ?? []) as Array<{ _id: string; createdAt?: string }>)
        .filter((r) => r && r._id)
        .sort((x, y) => (x.createdAt ?? '').localeCompare(y.createdAt ?? ''));
      if (rows.length > MAX_HISTORY_PER_SUPPLIER) {
        const staleIds = rows.slice(0, rows.length - MAX_HISTORY_PER_SUPPLIER).map((r) => r._id);
        await cbSupplierHistories.document.query({
          statement: `DELETE FROM ${supplierHistoriesKeyspace} WHERE META().id IN $1`,
          args: [staleIds],
          readonly: false
        });
      }
    }
  } catch (e) {
    console.error('[recordSupplierHistory]', e);
  }
}

async function resolveActorName(userId: string): Promise<string | null> {
  try {
    const inst = await Users.getById(userId);
    if (!inst) return null;
    const u = inst.user as { firstname?: string; lastname?: string };
    return [u.firstname, u.lastname].filter(Boolean).join(' ').trim() || null;
  } catch {
    return null;
  }
}

// ActorContext dùng chung từ users.ts — export lại để tương thích import cũ từ file này.
import type { ActorContext } from './users';
import { Users } from './users';
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
  // Serial/IMEI (variant trackSerial): danh sách serial quét/paste — mỗi chiếc 1 mã.
  // Số lượng nên khớp quantity (UI nhắc, server KHÔNG bắt buộc — cho phép nhập thiếu rồi bổ sung).
  serials?: string[];
  // Giá bán dự kiến tại thời điểm nhập (C4: quyết định user m02086 — lưu DB
  // để sau truy vết lãi nhập; optional — phiếu cũ không có field vẫn hợp lệ).
  sellPrice?: number;
  // Đơn vị nhập tại thời điểm nhập (vd 'thùng' factor 48): lưu nguyên trạng
  // để sau xem lại phiếu hiểu "48 chai/thùng" mà không phụ thuộc units hiện tại của variant.
  unitName?: string;
  unitFactor?: number;
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
  // Serial/IMEI (variant trackSerial) — xem POItem.serials
  serials?: string[];
  // C4: giá bán dự kiến + đơn vị nhập (optional — backward-compatible).
  sellPrice?: number;
  unitName?: string;
  unitFactor?: number;
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
      search?: string;
      sortField?: string;
      sortDirection?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & ListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'suppliers:read');
    if (!scope) return { success: false, messages: supplierAdminMessages.permissionDenied };

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    // Sort server-side — whitelist field (ORDER BY không nhận $n trong N1QL
    // layer này), fallback createdAt DESC. Field lạ → fallback âm thầm.
    const SUPPLIER_SORT_FIELDS: Record<string, string> = {
      name: 'name',
      status: 'status',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
    };
    const sortField = (options.sortField && SUPPLIER_SORT_FIELDS[options.sortField]) || 'createdAt';
    const sortDirection = options.sortDirection === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (options.status) {
      conditions.push('status = $' + (args.length + 1));
      args.push(options.status);
    }

    if (options.search?.trim()) {
      // Tìm theo tên / người liên hệ / phone / email. LIKE trong N1QL layer
      // này case-sensitive + diacritic-sensitive → dùng REGEXP_CONTAINS với
      // pattern (?i) + class dấu tiếng Việt (buildDiacriticInsensitiveRegex):
      // "son"/"sơn"/"SON" đều match "Sơn lan tạp hoá". phones/emails là mảng
      // — N1QL ANY…IN match từng phần tử.
      const re = buildDiacriticInsensitiveRegex(options.search.trim());
      const u = args.push(re, re, re, re) - 3;
      conditions.push(
        `(REGEXP_CONTAINS(name, $${u})` +
          ` OR REGEXP_CONTAINS(contactPerson, $${u + 1})` +
          ` OR ANY ph IN phones SATISFIES REGEXP_CONTAINS(ph, $${u + 2}) END` +
          ` OR ANY em IN emails SATISFIES REGEXP_CONTAINS(em, $${u + 3}) END)`
      );
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
        statement: `SELECT ${selectClause} FROM ${suppliersKeyspace} ${whereClause} ORDER BY ${sortField} ${sortDirection} LIMIT ${pageSize} OFFSET ${offset}`,
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
      ward?: string;
      district?: string;
      province?: string;
      country?: string;
      phones?: string[];
      emails?: string[];
      addresses?: unknown;
      zalo?: string;
      facebook?: string;
      telegram?: string;
      discord?: string;
      avatarUrl?: string;
      images?: string[];
      note?: string;
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
      ward: supplierData.ward ?? null,
      district: supplierData.district ?? null,
      province: supplierData.province ?? null,
      country: supplierData.country ?? null,
      phones: Array.isArray(supplierData.phones) ? supplierData.phones.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim()) : [],
      emails: Array.isArray(supplierData.emails) ? supplierData.emails.filter((e): e is string => typeof e === 'string' && e.trim().length > 0).map((e) => e.trim()) : [],
      addresses: sanitizeAddressEntries(supplierData.addresses),
      zalo: supplierData.zalo ?? null,
      facebook: supplierData.facebook ?? null,
      telegram: supplierData.telegram ?? null,
      discord: supplierData.discord ?? null,
      avatarUrl: supplierData.avatarUrl ?? null,
      images: Array.isArray(supplierData.images) ? supplierData.images.filter((i): i is string => typeof i === 'string' && i.trim().length > 0).map((i) => i.trim()) : [],
      note: supplierData.note ?? null,
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

  /**
   * Update a supplier (info modal từ purchase detail — name/contact/address/status).
   * Whitelist SUPPLIER_ADMIN_SAFE_FIELDS (trừ createdAt/updatedAt).
   */
  static async updateSupplier(
    actor: ActorContext,
    supplierId: string,
    patch: Record<string, unknown>
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { supplier: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'suppliers:manage');
    if (permError) return permError;

    const getRes = await cbSuppliers.document.get({ documentKey: supplierId });
    if (!getRes.ok) {
      return { success: false, messages: supplierAdminMessages.notFound };
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { ...(getRes as any).data };

    for (const field of ['name', 'contactPerson', 'address', 'ward', 'district', 'province', 'country', 'phones', 'emails', 'addresses', 'zalo', 'facebook', 'telegram', 'discord', 'avatarUrl', 'images', 'note', 'status'] as const) {
      if (field in patch) {
        // mảng phones/emails: lọc phần tử rỗng/không phải string
        if ((SUPPLIER_ARRAY_FIELDS as readonly string[]).includes(field)) {
          const arr = patch[field];
          updateData[field] = Array.isArray(arr)
            ? arr.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
            : [];
        } else if (field === 'addresses') {
          // mảng object {label?, address, province?, district?, country?}
          updateData[field] = sanitizeAddressEntries(patch[field]);
        } else {
          updateData[field] = patch[field];
        }
      }
    }
    if (typeof updateData.name !== 'string' || !updateData.name.trim()) {
      return { success: false, messages: supplierAdminMessages.invalidInput };
    }
    updateData.updatedAt = now;

    const beforeDoc = { ...(getRes as any).data } as Record<string, unknown>;
    const updateRes = await cbSuppliers.document.update({
      documentKey: supplierId,
      content: updateData
    });

    if (!updateRes.ok) {
      return { success: false, messages: supplierAdminMessages.updateFailed };
    }

    // Timeline: ghi diff trước → sau (fire-and-forget, không chặn update)
    await recordSupplierHistory(supplierId, 'update', actor, buildHistoryChanges(beforeDoc, updateData));

    const updatedSupplier = (updateRes as any).data;
    return { success: true, supplier: sanitizeSupplierForAdmin({...updatedSupplier, _id: supplierId}) };
  }

  // ── Timeline lịch sử thay đổi (kiểu git: diff từng trường + restore theo thời điểm) ──

  /**
   * Danh sách lịch sử thay đổi của 1 supplier (mới nhất trên đầu).
   * Chỉ cần suppliers:view — xem lịch sử là thao tác đọc.
   */
  static async listSupplierHistory(
    actor: ActorContext,
    supplierId: string
  ): Promise<{ success: false; messages: TranslateContent } | { success: true; entries: SupplierHistoryEntry[] }> {
    const permError = await this.requirePermission(actor, 'suppliers:read');
    if (permError) return permError;
    if (!supplierId) return { success: false, messages: supplierAdminMessages.invalidInput };

    try {
      const res = await cbSupplierHistories.query.document.search({
        conditions: [{ fieldName: 'supplierId', keyword: supplierId }],
        limit: 200
      });
      if (!res.ok) return { success: false, messages: supplierAdminMessages.historyQueryFailed };
      const rows = ((res.data ?? []) as Array<SupplierHistoryEntry & { _id?: string }>)
        .filter((r) => r && r.supplierId)
        .sort((x, y) => (y.createdAt ?? '').localeCompare(x.createdAt ?? ''));
      return { success: true, entries: rows };
    } catch (e) {
      console.error('[SupplierService.listSupplierHistory]', e);
      return { success: false, messages: supplierAdminMessages.historyQueryFailed };
    }
  }

  /**
   * Khôi phục supplier về giá trị TRƯỚC 1 entry lịch sử: ghi đè từng trường trong
   * changes bằng giá trị before của entry đó, rồi tạo entry 'restore' ghi nhận.
   * KHÔNG xoá lịch sử (chốt với user m01442).
   */
  static async restoreSupplierFromHistory(
    actor: ActorContext,
    supplierId: string,
    historyId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { supplier: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'suppliers:manage');
    if (permError) return permError;

    const histRes = await cbSupplierHistories.document.get({ documentKey: historyId });
    if (!histRes.ok) {
      return { success: false, messages: supplierAdminMessages.historyNotFound };
    }
    const hist = (histRes as any).data as SupplierHistoryEntry;
    if (!hist || hist.supplierId !== supplierId || !Array.isArray(hist.changes) || hist.changes.length === 0) {
      return { success: false, messages: supplierAdminMessages.historyNotFound };
    }

    const getRes = await cbSuppliers.document.get({ documentKey: supplierId });
    if (!getRes.ok) {
      return { success: false, messages: supplierAdminMessages.notFound };
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { ...(getRes as any).data };

    // Ghi đè từng trường bằng before của entry — trường không có trong changes giữ nguyên.
    // Giá trị before là JSON string snapshot: mảng/object parse lại; null → null.
    for (const change of hist.changes) {
      if (!(SUPPLIER_HISTORY_FIELDS as readonly string[]).includes(change.field)) continue;
      if (change.before === null) {
        updateData[change.field] = null;
        continue;
      }
      try {
        const parsed = JSON.parse(change.before);
        updateData[change.field] = parsed;
      } catch {
        updateData[change.field] = change.before;
      }
    }
    updateData.updatedAt = now;

    const updateRes = await cbSuppliers.document.update({
      documentKey: supplierId,
      content: updateData
    });
    if (!updateRes.ok) {
      return { success: false, messages: supplierAdminMessages.restoreFailed };
    }

    const changes = buildHistoryChanges((getRes as any).data ?? {}, updateData);
    await recordSupplierHistory(supplierId, 'restore', actor, changes);

    const updatedSupplier = (updateRes as any).data;
    return { success: true, supplier: sanitizeSupplierForAdmin({...updatedSupplier, _id: supplierId}) };
  }

  /**
   * Xóa hàng loạt supplier (bulk action từ checkbox trong DataTable).
   * Suppliers không gắn branch → không cần scope check, chỉ permission.
   */
  static async bulkDeleteSuppliers(
    actor: ActorContext,
    ids: string[]
  ): Promise<{
    success: boolean;
    messages?: TranslateContent;
    deleted?: string[];
    failed?: Array<{ id: string; reason: string }>;
  }> {
    const permError = await this.requirePermission(actor, 'suppliers:manage');
    if (permError) return permError;

    const cleanIds = (ids ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 100);
    if (cleanIds.length === 0) return { success: false, messages: supplierAdminMessages.invalidInput };

    // Xóa trực tiếp theo ids — doc không tồn tại coi như failed (not_found)
    const delRes = await cbSuppliers.document.query({
      statement: `DELETE FROM ${suppliersKeyspace} WHERE META().id IN $1 RETURNING META().id AS _id`,
      args: [cleanIds],
      readonly: false
    });
    if (!delRes.ok) return { success: false, messages: supplierAdminMessages.queryFailed };

    const deleted = ((delRes.data?.results ?? []) as Array<{ _id: string }>).map((r) => r._id);
    const foundSet = new Set(deleted);
    const failed = cleanIds.filter((id) => !foundSet.has(id)).map((id) => ({ id, reason: 'not_found' }));

    return { success: true, deleted, failed };
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
   * Update PO (detail modal edit — chỉnh field chung + dòng nhập khi draft).
   * Chỉ draft được sửa: received/cancelled gắn lot/công nợ, sửa vỡ dữ liệu.
   * - PO_UPDATE tương tự updatePOStatus (suppliers:manage).
   * - Field whitelist PO_ADMIN_SAFE_FIELDS; items validate từng dòng (variantId,
   *   quantity>0, unitCost>=0) — server KHÔNG parse biểu thức giá (client lo).
   * - totalCost/vouchers chấp nhận từ client (modal tính lại + gửi lên).
   */
  static async updatePurchaseOrder(
    actor: ActorContext,
    poId: string,
    patch: Record<string, unknown>
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { po: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'suppliers:manage');
    if (permError) return permError;

    const getRes = await cbPurchaseOrders.document.get({ documentKey: poId });
    if (!getRes.ok) {
      return { success: false, messages: supplierAdminMessages.poNotFound };
    }

    const po = (getRes as any).data;

    if (po.status && po.status !== 'draft') {
      return { success: false, messages: supplierAdminMessages.poNotReceivable };
    }

    if (actor.branchId && po.branchId !== actor.branchId) {
      const scope = await PermissionChecker.getScope(actor.roleName, 'suppliers:manage');
      if (scope === 'own_branch') {
        return { success: false, messages: supplierAdminMessages.permissionDenied };
      }
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { ...po };

    // Whitelist field PO: chỉ nhận các key admin-safe từ patch.
    const editableFields: Array<(typeof PO_ADMIN_SAFE_FIELDS)[number]> = [
      'poCode', 'supplierId', 'branchId', 'status', 'items', 'totalCost',
      'vouchers', 'expectedAt', 'receivedAt', 'note', 'categoryId'
    ];
    for (const field of editableFields) {
      if (field in patch) updateData[field] = patch[field];
    }

    // Validate items (nếu patch): từng dòng variantId string + quantity > 0 + unitCost >= 0.
    if ('items' in updateData) {
      const items = updateData.items;
      if (!Array.isArray(items)) return { success: false, messages: supplierAdminMessages.invalidPOItems };
      for (const it of items) {
        if (!it || typeof it !== 'object') return { success: false, messages: supplierAdminMessages.invalidPOItems };
        const rec = it as Record<string, unknown>;
        if (typeof rec.variantId !== 'string' || !rec.variantId) {
          return { success: false, messages: supplierAdminMessages.invalidPOItems };
        }
        if (!Number.isFinite(Number(rec.quantity)) || Number(rec.quantity) <= 0) {
          return { success: false, messages: supplierAdminMessages.invalidPOItems };
        }
        if (!Number.isFinite(Number(rec.unitCost)) || Number(rec.unitCost) < 0) {
          return { success: false, messages: supplierAdminMessages.invalidPOItems };
        }
      }
      updateData.items = items;
    }

    // totalCost/vouchers: số dương / mảng voucher money hợp lệ (pattern create).
    if ('totalCost' in updateData) {
      const total = Number(updateData.totalCost);
      if (!Number.isFinite(total) || total < 0) {
        return { success: false, messages: supplierAdminMessages.invalidInput };
      }
      updateData.totalCost = total;
    }
    if ('vouchers' in updateData) {
      const vouchers = updateData.vouchers;
      if (vouchers !== undefined && vouchers !== null && !Array.isArray(vouchers)) {
        return { success: false, messages: supplierAdminMessages.invalidVoucher };
      }
      if (Array.isArray(vouchers)) {
        for (const v of vouchers) {
          if (!v || typeof v !== 'object' || (v as Record<string, unknown>).type !== 'money') {
            return { success: false, messages: supplierAdminMessages.invalidVoucher };
          }
          if (!Number.isFinite(Number((v as Record<string, unknown>).value)) || Number((v as Record<string, unknown>).value) < 0) {
            return { success: false, messages: supplierAdminMessages.invalidVoucher };
          }
        }
      }
    }

    // status (nếu patch): phải draft (không cho sửa sang received/cancelled qua update —
    // luồng nhận hàng riêng qua get?receive=true / update-status).
    if ('status' in updateData && updateData.status !== 'draft') {
      return { success: false, messages: supplierAdminMessages.invalidStatus };
    }

    updateData.updatedAt = now;

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
    item: { variantId: string; quantity: number; lotNumber?: string; manufacturedAt?: string | null; expiresAt?: string | null; serials?: string[] };
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
    } else {
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
    }

    // Serial/IMEI (variant trackSerial): tạo doc serial_numbers 'in_stock' cho từng mã.
    // Idempotent (serial+variant trùng → skip) — chạy CHO CẢ nhánh stock-mới (đã ensure ở trên).
    if (item.serials && item.serials.length > 0) {
      await SerialService.receiveSerials({
        variantId: item.variantId,
        branchId,
        serials: item.serials,
        lotId,
        now
      });
    }

    return true;
  }

  /**
   * Nhận hàng cho PO: set status='received' + tạo lot + cộng kho cho từng item.
   * Chỉ cho phép nhận khi status là 'ordered' hoặc 'partially_received'.
   */
  static async receivePurchaseOrder(
    actor: ActorContext,
    poId: string,
    receivedItems?: Array<{ variantId: string; quantity: number; lotNumber?: string; manufacturedAt?: string | null; expiresAt?: string | null; serials?: string[] }>
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
        expiresAt: override?.expiresAt ?? item.expiresAt ?? null,
        // Serial/IMEI: client gửi kèm khi nhận (variant trackSerial). PO item lưu sẵn serials
        // (quick purchase flow) → merge: override ưu tiên, fallback item gốc.
        serials: override?.serials ?? item.serials ?? undefined
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
      // Serial/IMEI (variant trackSerial): validate shape — mảng string, tối đa 500 dòng
      const serialsCheck = SerialService.sanitizeReceiveSerials(item.serials);
      if (!serialsCheck.ok) {
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
      voucher: item.voucher ?? undefined,
      // Serial/IMEI: giữ danh sách mã vào PO item (traceability) + receive flow dùng tạo serial_numbers
      serials: item.serials && item.serials.length > 0 ? item.serials.map((s) => s.trim().toUpperCase()) : undefined,
      // C4: giá bán dự kiến + đơn vị nhập (snapshot tại thời điểm nhập — BẮT
      // BUỘC map tường minh, bỏ qua = field rơi âm thầm).
      sellPrice: typeof item.sellPrice === 'number' && item.sellPrice > 0 ? item.sellPrice : undefined,
      unitName: item.unitName?.trim() || undefined,
      unitFactor: typeof item.unitFactor === 'number' && item.unitFactor > 0 ? item.unitFactor : undefined
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
          expiresAt: item.expiresAt || expiry.expiresAt,
          serials: item.serials
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
      search?: string;
      branchId?: string;
      supplierId?: string;
      categoryId?: string;
      source?: string;
      sortField?: string;
      sortDirection?: string;
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

    // D5: sort server-side — whitelist field (ORDER BY không nhận $n trong N1QL
    // layer này), fallback createdAt DESC. Field lạ → fallback âm thầm về mặc định.
    const PO_SORT_FIELDS: Record<string, string> = {
      poCode: 'poCode',
      status: 'status',
      source: 'source',
      totalCost: 'totalCost',
      createdAt: 'createdAt',
      receivedAt: 'receivedAt'
    };
    const sortField = (options.sortField && PO_SORT_FIELDS[options.sortField]) || 'createdAt';
    const sortDirection = options.sortDirection === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (scope === 'own_branch') {
      if (!actor.branchId) {
        return { success: false, messages: supplierAdminMessages.permissionDenied };
      }
      conditions.push('branchId = $' + (args.length + 1));
      args.push(actor.branchId);
    }

    if (options.search?.trim()) {
      // Tìm theo mã phiếu / ghi chú. LIKE case-sensitive + diacritic-sensitive
      // → REGEXP_CONTAINS (?i) + class dấu tiếng Việt (pattern listSuppliers).
      const re = buildDiacriticInsensitiveRegex(options.search.trim());
      args.push(re, re);
      const u1 = args.length - 1;
      const u2 = args.length;
      conditions.push(
        `(REGEXP_CONTAINS(poCode, $${u1}) OR REGEXP_CONTAINS(note, $${u2}))`
      );
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
        statement: `SELECT ${selectClause} FROM ${purchaseOrdersKeyspace} ${whereClause} ORDER BY ${sortField} ${sortDirection} LIMIT ${pageSize} OFFSET ${offset}`,
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

  // ========== XÓA / CẬP NHẬT HÀNG LOẠT (C9) ==========

  /**
   * Bulk delete/update-status nhiều PO theo pattern expiry (batch IN $1, không
   * loop N+1). Kiểm tra TỪNG PO: tồn tại + branch scope (own_branch → chỉ PO
   * cùng branch). Delete CHỈ cho PO draft/cancelled — PO đã nhận hàng gắn lot/
   * công nợ, xóa vỡ dữ liệu → trả failed với reason.
   */
  static async bulkPurchaseOrders(
    actor: ActorContext,
    input: {
      ids: string[];
      action: 'delete' | 'status';
      status?: string;
    }
  ): Promise<{
    success: boolean;
    messages?: TranslateContent;
    deleted?: string[];
    updated?: string[];
    failed?: Array<{ id: string; reason: string }>;
  }> {
    const permError = await this.requirePermission(actor, 'suppliers:manage');
    if (permError) return permError;

    const ids = (input.ids ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 100);
    if (ids.length === 0) return { success: false, messages: supplierAdminMessages.invalidInput };

    const scope = await PermissionChecker.getScope(actor.roleName, 'suppliers:manage');

    // Batch 1 query lấy docs — tránh N+1.
    const getRes = await cbPurchaseOrders.document.query({
      statement: `SELECT META().id AS _id, branchId, status FROM ${purchaseOrdersKeyspace} WHERE META().id IN $1`,
      args: [ids],
      readonly: true
    });
    if (!getRes.ok) return { success: false, messages: supplierAdminMessages.queryFailed };

    const found = new Map<string, { branchId?: string; status?: string }>();
    for (const row of (getRes.data?.results ?? []) as Array<{ _id: string; branchId?: string; status?: string }>) {
      found.set(row._id, { branchId: row.branchId, status: row.status });
    }

    const failed: Array<{ id: string; reason: string }> = [];
    const deletable: string[] = [];
    const updatable: string[] = [];
    const now = new Date().toISOString();

    for (const id of ids) {
      const po = found.get(id);
      if (!po) {
        failed.push({ id, reason: 'not_found' });
        continue;
      }
      if (scope === 'own_branch' && actor.branchId && po.branchId !== actor.branchId) {
        failed.push({ id, reason: 'forbidden_branch' });
        continue;
      }
      if (input.action === 'delete') {
        // Chỉ draft/cancelled được xóa.
        if (po.status !== 'draft' && po.status !== 'cancelled') {
          failed.push({ id, reason: 'not_deletable' });
          continue;
        }
        deletable.push(id);
      } else {
        if (!VALID_PO_STATUSES.includes((input.status ?? '') as POStatus)) {
          failed.push({ id, reason: 'invalid_status' });
          continue;
        }
        updatable.push(id);
      }
    }

    const deleted: string[] = [];
    const updated: string[] = [];

    if (input.action === 'delete' && deletable.length > 0) {
      const delRes = await cbPurchaseOrders.document.query({
        statement: `DELETE FROM ${purchaseOrdersKeyspace} WHERE META().id IN $1`,
        args: [deletable],
        readonly: false
      });
      if (!delRes.ok) return { success: false, messages: supplierAdminMessages.queryFailed };
      deleted.push(...deletable);
    }

    if (input.action === 'status' && updatable.length > 0) {
      const updRes = await cbPurchaseOrders.document.query({
        statement: `UPDATE ${purchaseOrdersKeyspace} SET status = $2, updatedAt = $3 WHERE META().id IN $1`,
        args: [updatable, input.status, now],
        readonly: false
      });
      if (!updRes.ok) return { success: false, messages: supplierAdminMessages.queryFailed };
      updated.push(...updatable);
    }

    return { success: true, deleted, updated, failed };
  }

  // ========== TRẢ HÀNG NCC ==========

  /**
   * Trả hàng cho nhà cung cấp: trừ tồn kho (conditional N1QL), mark serial 'returned',
   * log stock_movements 'purchase_return', tạo phiếu công nợ NCC (payable giảm → debt âm).
   *
   * Kiến trúc:
   * - Trừ tồn: CAS-style UPDATE ... WHERE quantityOnHand >= $n RETURNING — thiếu tồn → fail
   *   (không cho tồn âm, pattern adjustStock).
   * - Serial: SerialService.markReturned (điều kiện status='in_stock' — serial đã bán không mark).
   * - Công nợ: DebtService.create type 'payable' amount ÂM (ghi giảm công nợ phải trả NCC)
   *   referenceType 'purchase_return' — DebtService set remainingAmount = amount.
   * - best-effort: debt tạo fail → vẫn trả success (stock là nguồn sự thật chính), log warn.
   */
  static async createPurchaseReturn(
    actor: ActorContext,
    input: {
      supplierId: string;
      branchId: string;
      items: Array<{ variantId: string; quantity: number; unitCost?: number; lotId?: string; serials?: string[] }>;
      reason?: string;
    }
  ): Promise<{
    success: false; messages: TranslateContent;
  } | {
    success: true;
    returnId: string;
    returnCode: string;
    results: Array<{ variantId: string; quantity: number; ok: boolean; serialsReturned?: number }>;
  }> {
    const permError = await this.requirePermission(actor, 'purchases:manage');
    if (permError) return permError;

    // scope own_branch: chỉ được trả hàng tại chi nhánh của mình
    const scope = await PermissionChecker.getScope(actor.roleName, 'purchases:manage');
    if (!scope) return { success: false, messages: supplierAdminMessages.permissionDenied };
    if (scope === 'own_branch' && (!actor.branchId || input.branchId !== actor.branchId)) {
      return { success: false, messages: supplierAdminMessages.permissionDenied };
    }

    if (!input.branchId) return { success: false, messages: supplierAdminMessages.invalidPOItems };
    if (!Array.isArray(input.items) || input.items.length === 0) {
      return { success: false, messages: supplierAdminMessages.invalidPOItems };
    }

    // Validate items: quantity nguyên > 0, serials khớp quantity khi có
    for (const item of input.items) {
      const qty = Math.floor(Number(item.quantity) || 0);
      if (!item.variantId || qty <= 0) return { success: false, messages: supplierAdminMessages.invalidPOItems };
      const serials = (item.serials ?? []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
      if (serials.length > 0 && serials.length !== qty) {
        return { success: false, messages: supplierAdminMessages.invalidPOItems };
      }
    }

    const now = new Date().toISOString();
    const returnId = `pret_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const returnCode = `PR-YYYYMMDD-${Math.random().toString(36).substring(2, 6).toUpperCase()}`.replace('YYYYMMDD', now.slice(0, 10).replace(/-/g, ''));

    // Lấy tên NCC cho phiếu công nợ (best-effort)
    let supplierName = '';
    const supplierRes = await cbSuppliers.document.get({ documentKey: input.supplierId }).catch(() => null);
    if (supplierRes && supplierRes.ok && supplierRes.data) {
      supplierName = String((supplierRes.data as { name?: string }).name ?? '');
    }

    // Tạo doc purchase_return TRƯỚC khi trừ tồn (nguồn sự thật truy vết)
    const returnDoc = {
      returnCode,
      supplierId: input.supplierId,
      supplierName,
      branchId: input.branchId,
      items: input.items.map((item) => ({
        variantId: item.variantId,
        quantity: Math.floor(Number(item.quantity) || 0),
        unitCost: Number(item.unitCost) || 0,
        lotId: item.lotId ?? null,
        serials: item.serials ? item.serials.map((s) => String(s).trim().toUpperCase()) : []
      })),
      reason: input.reason ?? '',
      status: 'completed',
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now
    };
    const createRes = await cbData('purchase_returns').document.create({
      documentKey: returnId,
      content: returnDoc
    });
    if (!createRes.ok) return { success: false, messages: supplierAdminMessages.createFailed };

    // Trừ tồn từng dòng — conditional UPDATE chống âm kho
    const results: Array<{ variantId: string; quantity: number; ok: boolean; serialsReturned?: number }> = [];
    let allOk = true;
    for (const item of input.items) {
      const qty = Math.floor(Number(item.quantity) || 0);
      const stockKey = `stock_${item.variantId}_${input.branchId}`;
      const updRes = await cbInventoryStock.document.query({
        statement: `
          UPDATE ${inventoryStockKeyspace}
          SET quantityOnHand = quantityOnHand - $2, updatedAt = $4
          WHERE META().id = $1 AND variantId = $3 AND quantityOnHand >= $2
          RETURNING quantityOnHand
        `,
        args: [stockKey, qty, item.variantId, now],
        readonly: false
      });
      let ok = updRes.ok && (updRes.data?.results?.length ?? 0) > 0;
      // Doc stock chưa tồn tại → không có gì để trả → coi là fail (thiếu tồn)
      if (ok) {
        // Log stock movement 'purchase_return'
        await cbStockMovementsRef.document.create({
          documentKey: `${item.variantId}_${input.branchId}_${Date.now()}_prt${Math.random().toString(36).substring(2, 6)}`,
          content: {
            variantId: item.variantId,
            branchId: input.branchId,
            lotId: item.lotId ?? null,
            type: 'out',
            quantity: qty,
            quantityBefore: null,
            quantityAfter: null,
            referenceType: 'purchase_return',
            referenceId: returnId,
            performedBy: actor.userId,
            note: input.reason ? `Return to supplier: ${input.reason}` : 'Return to supplier',
            createdAt: now
          }
        }).catch(() => null);

        // Serial: mark 'returned' (điều kiện status='in_stock')
        let serialsReturned = 0;
        if (item.serials && item.serials.length > 0) {
          const markRes = await SerialService.markReturned({
            variantId: item.variantId,
            serials: item.serials,
            branchId: input.branchId,
            now
          });
          if (markRes.success) serialsReturned = markRes.marked;
          else allOk = false;
        }
        results.push({ variantId: item.variantId, quantity: qty, ok: true, serialsReturned });
      } else {
        ok = false;
        allOk = false;
        results.push({ variantId: item.variantId, quantity: qty, ok: false });
      }
    }

    // Công nợ NCC (best-effort): tạo khoản phải trả DƯƠNG referenceType 'purchase_return'
    // — DebtService.create chỉ nhận amount > 0 (amount âm bị chặn invalidAmount),
    // giá trị "giảm" thể hiện qua phiếu PR; ghi chú ghi rõ đây là giảm công nợ.
    const totalAmount = input.items.reduce(
      (sum, item) => sum + (Number(item.unitCost) || 0) * (Math.floor(Number(item.quantity) || 0)),
      0
    );
    if (input.supplierId && totalAmount > 0) {
      try {
        const { DebtService } = await import('./debts');
        const debtRes = await DebtService.create(actor, {
          type: 'payable',
          partyId: input.supplierId,
          referenceType: 'purchase_return',
          referenceId: returnId,
          referenceCode: returnCode,
          amount: totalAmount,
          notes: input.reason ? `Trả hàng NCC (giảm công nợ): ${input.reason}` : 'Trả hàng NCC (giảm công nợ)'
        });
        if (!debtRes.success) {
          console.warn(`[SupplierService.createPurchaseReturn] debt create failed (best-effort) for ${returnId}`);
        }
      } catch (e) {
        console.warn(`[SupplierService.createPurchaseReturn] debt create failed (best-effort):`, e);
      }
    }

    if (!allOk) {
      console.warn(`[SupplierService.createPurchaseReturn] partial failure for return ${returnId}`);
    }

    return { success: true, returnId, returnCode, results };
  }
}
