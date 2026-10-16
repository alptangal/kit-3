// $lib/server/db/serials.ts
// Serial/IMEI tracking — mã định danh từng chiếc hàng (SIM nhiều serial, điện thoại nhiều IMEI).
//
// Kiến trúc:
// - Collection 'serial_numbers' (schema.ts): { variantId, branchId, serial, status, lotId?, orderId?, receivedAt, soldAt, notes? }.
// - Variant bật trackSerial → nhập hàng (receive PO / quick purchase) nhận thêm mảng serials[] per item,
//   mỗi serial tạo 1 doc serial_numbers 'in_stock' (IDEMPOTENT: serial+variant đã tồn tại → bỏ qua, log skip).
// - POS bán variant trackSerial → bắt buộc chọn serial cụ thể; checkout chuyển status 'sold' + orderId.
// - Trả hàng / đổi trả → 'returned'. API đổi trạng thái cho hư hỏng/khôi phục.
import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { SerialNumber } from '$modules/schema';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import type { ActorContext } from './users';

const cbSerials = cbData('serial_numbers');
const cbVariants = cbData('product_variants');
const cbOrders = cbData('orders');

const serialsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`serial_numbers\``;

const serialMessages = {
  permissionDenied: {
    vi: 'Bạn không có quyền thực hiện thao tác này',
    en: 'You do not have permission to perform this action'
  } as TranslateContent,
  queryFailed: {
    vi: 'Truy vấn serial thất bại',
    en: 'Failed to query serials'
  } as TranslateContent,
  notFound: {
    vi: 'Không tìm thấy serial',
    en: 'Serial not found'
  } as TranslateContent,
  invalidStatus: {
    vi: 'Trạng thái serial không hợp lệ',
    en: 'Invalid serial status'
  } as TranslateContent,
  invalidSerials: {
    vi: 'Danh sách serial không hợp lệ',
    en: 'Invalid serial list'
  } as TranslateContent,
  variantNotFound: {
    vi: 'Không tìm thấy biến thể sản phẩm',
    en: 'Product variant not found'
  } as TranslateContent,
  serialNotInStock: {
    vi: 'Serial không còn tồn trong kho',
    en: 'Serial is no longer in stock'
  } as TranslateContent,
  updateFailed: {
    vi: 'Cập nhật serial thất bại',
    en: 'Failed to update serial'
  }
} as const;

export const SERIAL_STATUSES = ['in_stock', 'sold', 'returned', 'defective'] as const;
export type SerialStatus = (typeof SERIAL_STATUSES)[number];

const SERIAL_ADMIN_SAFE_FIELDS = [
  'variantId',
  'branchId',
  'serial',
  'status',
  'lotId',
  'orderId',
  'receivedAt',
  'soldAt',
  'notes',
  'createdAt',
  'updatedAt'
] as const;

function sanitizeSerialForAdmin(doc: Record<string, unknown> & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of SERIAL_ADMIN_SAFE_FIELDS) {
    safe[field] = doc[field];
  }
  return safe;
}

interface SerialListResult {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

export class SerialService {
  /**
   * Ghi serials cho 1 dòng nhập hàng — IDEMPOTENT.
   * Mỗi serial: nếu (variantId, serial) đã tồn tại → bỏ qua (skip, log count);
   * chưa có → tạo doc 'in_stock' với key `serial_${variantId}_${hash(serial)}` (hash để key an toàn ký tự đặc biệt).
   * Trả { created, skipped } để caller log/nhét vào response.
   */
  static async receiveSerials(params: {
    variantId: string;
    branchId: string;
    serials: string[];
    lotId?: string;
    now: string;
  }): Promise<{ created: number; skipped: number }> {
    const { variantId, branchId, now } = params;
    // Chuẩn hoá: trim, bỏ dòng rỗng/trùng trong chính mảng gửi lên
    const seen = new Set<string>();
    const list: string[] = [];
    for (const raw of params.serials ?? []) {
      const s = String(raw ?? '').trim();
      if (!s) continue;
      const upper = s.toUpperCase();
      if (seen.has(upper)) continue;
      seen.add(upper);
      list.push(upper);
    }

    let created = 0;
    let skipped = 0;
    for (const serial of list) {
      // Idempotent: query (variantId, serial) — doc cũ giữ nguyên, không update status
      const existing = await cbSerials.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${serialsKeyspace} WHERE variantId = $1 AND serial = $2`,
        args: [variantId, serial],
        readonly: true
      });
      if (existing.ok && Number(existing.data?.results?.[0] ?? 0) > 0) {
        skipped++;
        continue;
      }
      const docKey = `serial_${variantId}_${hashKey(serial)}`;
      const doc: SerialNumber = {
        variantId,
        branchId,
        serial,
        status: 'in_stock',
        lotId: params.lotId ?? null,
        orderId: null,
        receivedAt: now,
        soldAt: null,
        notes: null,
        createdAt: now,
        updatedAt: now
      };
      const res = await cbSerials.document.create({ documentKey: docKey, content: doc });
      if (res.ok) created++;
      else skipped++;
    }
    return { created, skipped };
  }

  /**
   * Danh sách serial cho trang quản lý + POS picker.
   * Filter: variantId / branchId / status / search (LIKE serial).
   * Permission: inventory:read (scope own_branch ép branchId khớp).
   */
  static async listSerials(
    actor: ActorContext,
    options: {
      variantId?: string;
      branchId?: string;
      status?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & SerialListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:read');
    if (!scope) return { success: false, messages: serialMessages.permissionDenied };

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (scope === 'own_branch') {
      if (!actor.branchId) return { success: false, messages: serialMessages.permissionDenied };
      conditions.push('branchId = $' + (args.length + 1));
      args.push(actor.branchId);
    }
    if (options.variantId) {
      conditions.push('variantId = $' + (args.length + 1));
      args.push(options.variantId);
    }
    if (options.branchId) {
      conditions.push('branchId = $' + (args.length + 1));
      args.push(options.branchId);
    }
    if (options.status) {
      conditions.push('status = $' + (args.length + 1));
      args.push(options.status);
    }
    if (options.search) {
      conditions.push('serial LIKE $' + (args.length + 1));
      args.push(`%${options.search.trim().toUpperCase()}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const selectClause = 'META().id AS _id, ' + SERIAL_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

    const [countRes, dataRes] = await Promise.all([
      cbSerials.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${serialsKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbSerials.document.query({
        statement: `SELECT ${selectClause} FROM ${serialsKeyspace} ${whereClause} ORDER BY createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: serialMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizeSerialForAdmin);
    return { success: true, items, total, page, pageSize };
  }

  /**
   * Serial in_stock của 1 variant tại 1 branch — phục vụ POS picker (quét/paste serial).
   * Trả TẤT CẢ (không phân trang — số serial tồn tại 1 variant/branch thường nhỏ).
   */
  static async listInStockForVariant(
    actor: ActorContext,
    variantId: string,
    branchId: string
  ): Promise<{ success: false; messages: TranslateContent } | { success: true; items: Record<string, unknown>[] }> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:read');
    if (!scope) return { success: false, messages: serialMessages.permissionDenied };

    const conditions = ['variantId = $1', 'branchId = $2', "status = 'in_stock'"];
    const args: (string | number)[] = [variantId, branchId];
    if (scope === 'own_branch') {
      if (!actor.branchId) return { success: false, messages: serialMessages.permissionDenied };
      if (actor.branchId !== branchId) return { success: false, messages: serialMessages.permissionDenied };
    }

    const res = await cbSerials.document.query({
      statement: `SELECT META().id AS _id, ${SERIAL_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')} FROM ${serialsKeyspace} WHERE ${conditions.join(' AND ')} ORDER BY receivedAt ASC LIMIT 500`,
      args,
      readonly: true
    });
    if (!res.ok) return { success: false, messages: serialMessages.queryFailed };
    return { success: true, items: res.data?.results ?? [] };
  }

  /**
   * Checkout POS: chuyển N serial sang 'sold' + orderId + soldAt.
   * Điều kiện N1QL status='in_stock' chống race (2 quầy bán cùng serial) — đếm mutationCount.
   * Serial không còn in_stock → trả lỗi kèm danh sách.
   */
  static async markSold(params: {
    variantId: string;
    serials: string[];
    branchId: string;
    orderId: string;
    now: string;
  }): Promise<{ success: boolean; messages?: TranslateContent; marked: number }> {
    const { variantId, branchId, orderId, now } = params;
    const list = Array.from(new Set((params.serials ?? []).map((s) => String(s ?? '').trim().toUpperCase()).filter(Boolean)));
    if (list.length === 0) return { success: true, marked: 0 };

    let marked = 0;
    const notFound: string[] = [];
    for (const serial of list) {
      const res = await cbSerials.document.query({
        statement: `UPDATE ${serialsKeyspace}
          SET status = 'sold', orderId = $4, soldAt = $5, updatedAt = $5
          WHERE variantId = $1 AND branchId = $2 AND serial = $3 AND status = 'in_stock' RETURNING \`serial\``,
        args: [variantId, branchId, serial, orderId, now],
        readonly: false
      });
      if (res.ok && (res.data?.results?.length ?? 0) > 0) {
        marked++;
      } else {
        notFound.push(serial);
      }
    }
    if (notFound.length > 0) {
      return {
        success: false,
        messages: {
          vi: `Serial không còn tồn trong kho: ${notFound.join(', ')}`,
          en: `Serials no longer in stock: ${notFound.join(', ')}`
        },
        marked
      };
    }
    return { success: true, marked };
  }

  /**
   * Đổi trả / thu hồi: serial từ 'sold'/'in_stock'/'defective' → 'returned'.
   */
  static async markReturned(params: { variantId: string; serials: string[]; branchId: string; now: string }): Promise<{ success: boolean; marked: number }> {
    const { variantId, branchId, now } = params;
    const list = Array.from(new Set((params.serials ?? []).map((s) => String(s ?? '').trim().toUpperCase()).filter(Boolean)));
    let marked = 0;
    for (const serial of list) {
      const res = await cbSerials.document.query({
        statement: `UPDATE ${serialsKeyspace}
          SET status = 'returned', updatedAt = $4
          WHERE variantId = $1 AND branchId = $2 AND serial = $3`,
        args: [variantId, branchId, serial, now],
        readonly: false
      });
      if (res.ok) marked += res.data?.results?.length ?? 0;
    }
    return { success: true, marked };
  }

  /**
   * Đổi trạng thái thủ công (trang quản lý serial): defective/khôi phục/đánh dấu sold...
   * Permission: inventory:manage.
   */
  static async updateStatus(
    actor: ActorContext,
    documentKey: string,
    status: SerialStatus,
    notes?: string
  ): Promise<{ success: boolean; messages: TranslateContent }> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'inventory:manage');
    if (!scope) return { success: false, messages: serialMessages.permissionDenied };

    if (!SERIAL_STATUSES.includes(status)) {
      return { success: false, messages: serialMessages.invalidStatus };
    }

    const getRes = await cbSerials.document.get({ documentKey });
    if (!getRes.ok || !getRes.data) {
      return { success: false, messages: serialMessages.notFound };
    }
    const doc = getRes.data as SerialNumber & { _id: string };
    if (scope === 'own_branch' && actor.branchId && doc.branchId !== actor.branchId) {
      return { success: false, messages: serialMessages.permissionDenied };
    }

    const now = new Date().toISOString();
    const updateRes = await cbSerials.document.update({
      documentKey,
      content: {
        ...doc,
        status,
        notes: notes ?? doc.notes ?? null,
        soldAt: status === 'sold' ? (doc.soldAt ?? now) : doc.soldAt,
        updatedAt: now
      } as SerialNumber
    });
    if (!updateRes.ok) return { success: false, messages: serialMessages.updateFailed };
    return { success: true, messages: { vi: 'Cập nhật serial thành công', en: 'Serial updated successfully' } };
  }

  /**
   * Validate mảng serials từ client cho flow nhập hàng — mỗi phần tử string, giới hạn 500 dòng.
   */
  static sanitizeReceiveSerials(raw: unknown): { ok: true; serials: string[] } | { ok: false } {
    if (raw == null) return { ok: true, serials: [] };
    if (!Array.isArray(raw)) return { ok: false };
    if (raw.length > 500) return { ok: false };
    for (const item of raw) {
      if (typeof item !== 'string' || !item.trim()) return { ok: false };
    }
    return { ok: true, serials: raw.map((s) => s.trim().toUpperCase()) };
  }

  /**
   * Kiểm tra variant có bật trackSerial không (POS / UI nhập hàng dùng để hiện/ẩn picker).
   */
  static async variantTracksSerial(variantId: string): Promise<boolean> {
    const res = await cbVariants.document.get({ documentKey: variantId });
    if (!res.ok || !res.data) return false;
    return Boolean((res.data as { trackSerial?: boolean }).trackSerial);
  }

  /**
   * Lấy orderId + status đơn (trang quản lý serial dùng hiển thị).
   */
  static async getOrderBrief(orderId: string): Promise<{ orderCode?: string; status?: string } | null> {
    const res = await cbOrders.document.get({ documentKey: orderId });
    if (!res.ok || !res.data) return null;
    const doc = res.data as { orderCode?: string; status?: string };
    return { orderCode: doc.orderCode, status: doc.status };
  }
}

/** Hash ổn định cho documentKey — serial có thể chứa ký tự lạ (IMEI thì không, nhưng không rủi ro). */
function hashKey(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
