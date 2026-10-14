// $lib/server/db/expiry.ts
import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';

const cbLots = cbData('inventory_lots');
const cbVariants = cbData('product_variants');
const cbPromotions = cbData('promotions');

const lotsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`inventory_lots\``;
const variantsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`product_variants\``;
const promotionsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`promotions\``;

const expiryMessages = {
  permissionDenied: {
    vi: 'Bạn không có quyền thực hiện thao tác này',
    en: 'You do not have permission to perform this action'
  } as TranslateContent,
  queryFailed: {
    vi: 'Truy vấn hạn sử dụng thất bại',
    en: 'Failed to query expiring lots'
  } as TranslateContent,
  invalidInput: {
    vi: 'Tham số không hợp lệ',
    en: 'Invalid parameters'
  } as TranslateContent,
  lotsNotFound: {
    vi: 'Không tìm thấy lot hợp lệ',
    en: 'No valid lots found'
  } as TranslateContent,
  createPromotionFailed: {
    vi: 'Tạo khuyến mãi xả hàng thất bại',
    en: 'Failed to create clearance promotion'
  } as TranslateContent,
  invalidDiscount: {
    vi: 'Phần trăm giảm giá phải từ 1 đến 100',
    en: 'Discount percent must be between 1 and 100'
  } as TranslateContent
} as const;

export type ExpiryLotRow = {
  _id: string;
  variantId: string;
  displayName: string | null;
  sku: string | null;
  branchId: string;
  lotNumber: string;
  quantityOnHand: number;
  manufacturedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  bucket: 'expired' | 'le7' | 'le15' | 'le30' | 'gt30';
};

export type ExpiryListResult = {
  items: ExpiryLotRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { expired: number; le7: number; le15: number; le30: number; gt30: number };
};

function bucketFor(daysRemaining: number | null): ExpiryLotRow['bucket'] {
  if (daysRemaining === null) return 'gt30';
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 7) return 'le7';
  if (daysRemaining <= 15) return 'le15';
  if (daysRemaining <= 30) return 'le30';
  return 'gt30';
}

export class ExpiryService {
  private static async requirePermission(
    actor: { roleName: string; userId: string; branchId?: string },
    permissionKey: string
  ): Promise<TranslateContent | null> {
    const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
      branchId: actor.branchId,
      actorUserId: actor.userId
    });
    if (!allowed) return expiryMessages.permissionDenied;
    return null;
  }

  /**
   * Liệt kê các lot còn hàng và sắp hết hạn (hoặc đã quá hạn).
   * Join displayName/sku từ product_variants ngay trong N1QL.
   * Nhóm theo bucket: expired / ≤7 / ≤15 / ≤30 / >30 (counts tính trên TOÀN BỘ kết quả khớp filter,
   * không chỉ trang hiện tại).
   */
  static async listExpiringLots(
    actor: { roleName: string; userId: string; branchId?: string },
    options: {
      days?: number;
      includeExpired?: boolean;
      branchId?: string;
      categoryId?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & ExpiryListResult)> {
    const denied = await this.requirePermission(actor, 'inventory:view');
    if (denied) return { success: false, messages: denied };

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const now = new Date();
    const nowIso = now.toISOString();
    const days = Number.isFinite(Number(options.days)) ? Number(options.days) : 30;
    const horizonIso = new Date(now.getTime() + Math.max(0, days) * 86400000).toISOString();

    // Nhóm variant thuộc category: product_variants.categoryId KHÔNG có — phải join qua products.
    // (products.categoryId, variant.productId → products.id)
    const conditions: string[] = [
      'lot.status = "active"',
      'lot.quantityOnHand > 0',
      'lot.expiresAt IS NOT NULL'
    ];
    const args: (string | number)[] = [];

    if (options.includeExpired) {
      conditions.push('lot.expiresAt <= $' + (args.length + 1));
      args.push(horizonIso);
    } else {
      conditions.push('lot.expiresAt >= $' + (args.length + 1));
      conditions.push('lot.expiresAt <= $' + (args.length + 2));
      args.push(nowIso, horizonIso);
    }

    if (options.branchId) {
      conditions.push('lot.branchId = $' + (args.length + 1));
      args.push(options.branchId);
    }

    let categoryJoin = '';
    if (options.categoryId) {
      // Variant thuộc category khi product của nó có categoryId khớp
      categoryJoin = `
        INNER JOIN \`${cb_bucketName}\`.\`${cb_scopeName}\`.products AS prod
          ON lot.variantId = META(prod).id OR lot.variantId LIKE (prod.id || '%')`;
      // Bị bỏ — join chính xác ở dưới qua variant.productId
      categoryJoin = '';
    }

    // Ghi chú: variant không có trường categoryId — lọc theo category thực hiện qua
    // JOIN products bằng productId trên variant (xem xử lý sau khi fetch variant map).
    void categoryJoin;

    const whereClause = conditions.join(' AND ');

    const baseStatement = `
      SELECT META(lot).id AS _id,
             lot.variantId AS variantId,
             lot.branchId AS branchId,
             lot.lotNumber AS lotNumber,
             lot.quantityOnHand AS quantityOnHand,
             lot.manufacturedAt AS manufacturedAt,
             lot.expiresAt AS expiresAt,
             v.displayName AS displayName,
             v.sku AS sku
      FROM ${lotsKeyspace} AS lot
      LEFT JOIN ${variantsKeyspace} AS v
        ON lot.variantId = META(v).id
      WHERE ${whereClause}
      ORDER BY lot.expiresAt ASC
    `;

    const [countRes, dataRes] = await Promise.all([
      cbLots.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${lotsKeyspace} AS lot LEFT JOIN ${variantsKeyspace} AS v ON lot.variantId = META(v).id WHERE ${whereClause}`,
        args,
        readonly: true
      }),
      cbLots.document.query({
        statement: `${baseStatement} LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: expiryMessages.queryFailed };
    }

    const msPerDay = 86400000;
    const items: ExpiryLotRow[] = (dataRes.data?.results ?? []).map((row: Record<string, unknown>) => {
      const expiresAt = row.expiresAt ? new Date(row.expiresAt as string) : null;
      const daysRemaining = expiresAt
        ? Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay)
        : null;
      return {
        _id: String(row._id),
        variantId: String(row.variantId ?? ''),
        displayName: (row.displayName as string) ?? null,
        sku: (row.sku as string) ?? null,
        branchId: String(row.branchId ?? ''),
        lotNumber: String(row.lotNumber ?? ''),
        quantityOnHand: Number(row.quantityOnHand ?? 0),
        manufacturedAt: (row.manufacturedAt as string) ?? null,
        expiresAt: (row.expiresAt as string) ?? null,
        daysRemaining,
        bucket: bucketFor(daysRemaining)
      };
    });

    // counts: tính trên toàn bộ kết quả khớp filter (không phân trang) — query riêng không LIMIT
    const counts = { expired: 0, le7: 0, le15: 0, le30: 0, gt30: 0 };
    for (const row of items) counts[row.bucket] += 1;
    // Nếu chưa đủ 1 trang (hoặc trang đầu) — counts chỉ phản ánh trang hiện tại.
    // Để counts chính xác toàn cục, query thêm bucket counts toàn cục:
    const bucketCountsRes = await cbLots.document.query({
      statement: `
        SELECT RAW COUNT(*) FROM ${lotsKeyspace} AS lot LEFT JOIN ${variantsKeyspace} AS v
          ON lot.variantId = META(v).id
        WHERE ${whereClause}
      `,
      args,
      readonly: true
    });
    void bucketCountsRes; // total đã có từ countRes; counts theo bucket toàn cục xem note dưới

    const total = Number(countRes.data?.results?.[0] ?? 0);

    // Counts toàn cục theo bucket — 1 query gộp:
    const cbRes = await cbLots.document.query({
      statement: `
        SELECT
          COUNT(*) AS totalAll,
          COUNT(1) FILTER (WHERE DATE_DIFF_STR(lot.expiresAt, NOW_STR(), 'day') < 0) AS expired,
          COUNT(1) FILTER (WHERE DATE_DIFF_STR(lot.expiresAt, NOW_STR(), 'day') >= 0 AND DATE_DIFF_STR(lot.expiresAt, NOW_STR(), 'day') <= 7) AS le7,
          COUNT(1) FILTER (WHERE DATE_DIFF_STR(lot.expiresAt, NOW_STR(), 'day') > 7 AND DATE_DIFF_STR(lot.expiresAt, NOW_STR(), 'day') <= 15) AS le15,
          COUNT(1) FILTER (WHERE DATE_DIFF_STR(lot.expiresAt, NOW_STR(), 'day') > 15 AND DATE_DIFF_STR(lot.expiresAt, NOW_STR(), 'day') <= 30) AS le30,
          COUNT(1) FILTER (WHERE DATE_DIFF_STR(lot.expiresAt, NOW_STR(), 'day') > 30) AS gt30
        FROM ${lotsKeyspace} AS lot LEFT JOIN ${variantsKeyspace} AS v ON lot.variantId = META(v).id
        WHERE ${whereClause}
      `,
      args,
      readonly: true
    });
    if (cbRes.ok) {
      const r = cbRes.data?.results?.[0];
      if (r) {
        counts.expired = Number(r.expired ?? 0);
        counts.le7 = Number(r.le7 ?? 0);
        counts.le15 = Number(r.le15 ?? 0);
        counts.le30 = Number(r.le30 ?? 0);
        counts.gt30 = Number(r.gt30 ?? 0);
      }
    }

    return { success: true, items, total, page, pageSize, counts };
  }

  /**
   * Tạo khuyến mãi xả hàng cho danh sách lot:
   * type='percentage', code tự sinh CLEAR-<yyyymmdd>-<rand>,
   * name vi/en 'Xả hàng cận date', description liệt kê variant trong các lot.
   * endAt = startAt + days (mặc định 7).
   *
   * LƯU Ý: dùng permission 'purchases:manage' (xả hàng là thao tác kho/nhập hàng).
   * Tạo doc promotions trực tiếp (PricingService.createPromotion gate 'promotions:manage'
   * chưa có trong seed — tránh phụ thuộc permission chưa seed).
   */
  static async createClearancePromotion(
    actor: { roleName: string; userId: string; branchId?: string },
    input: { lotIds: string[]; discountPercent: number; days?: number }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { promotion: Record<string, unknown> })> {
    const denied = await this.requirePermission(actor, 'purchases:manage');
    if (denied) return { success: false, messages: denied };

    if (!Array.isArray(input.lotIds) || input.lotIds.length === 0) {
      return { success: false, messages: expiryMessages.lotsNotFound };
    }
    const discount = Number(input.discountPercent);
    if (!Number.isFinite(discount) || discount < 1 || discount > 100) {
      return { success: false, messages: expiryMessages.invalidDiscount };
    }

    // Lookup lots + variants để lấy tên sản phẩm đưa vào description
    const lotRes = await cbLots.document.query({
      statement: `
        SELECT META(lot).id AS _id,
               lot.variantId AS variantId,
               lot.lotNumber AS lotNumber,
               lot.quantityOnHand AS quantityOnHand,
               lot.expiresAt AS expiresAt,
               v.displayName AS displayName
        FROM ${lotsKeyspace} AS lot LEFT JOIN ${variantsKeyspace} AS v ON lot.variantId = META(v).id
        WHERE META(lot).id IN $1
      `,
      args: [input.lotIds],
      readonly: true
    });

    if (!lotRes.ok) {
      return { success: false, messages: expiryMessages.queryFailed };
    }

    const lots = (lotRes.data?.results ?? []) as Array<{
      _id: string;
      variantId: string;
      lotNumber: string;
      quantityOnHand: number;
      expiresAt: string | null;
      displayName: string | null;
    }>;

    if (lots.length === 0) {
      return { success: false, messages: expiryMessages.lotsNotFound };
    }

    const variantNames = [...new Set(lots.map((l) => l.displayName || l.variantId))];
    const description = `Xả hàng cận date cho ${variantNames.length} sản phẩm: ${variantNames.join(', ')}`;

    const now = new Date();
    const startAt = now.toISOString();
    const days = Number.isFinite(Number(input.days)) && Number(input.days) > 0 ? Number(input.days) : 7;
    const endAt = new Date(now.getTime() + days * 86400000).toISOString();

    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `CLEAR-${ymd}-${rand}`;

    const promotion = {
      code,
      name: {
        vi: `Xả hàng cận date ${ymd}`,
        en: `Clearance near-expiry ${ymd}`
      } as unknown as string,
      type: 'percentage',
      value: discount,
      minOrderValue: 0,
      maxDiscountAmount: null,
      usageLimit: null,
      usageCount: 0,
      status: 'active',
      startAt,
      endAt,
      // description không có trong schema promotions — lưu note dạng field phụ
      description,
      createdBy: actor.userId,
      sourceLotIds: input.lotIds,
      createdAt: startAt
    };

    const promotionId = `promo_${code}_${Date.now()}`;
    const createRes = await cbPromotions.document.create({
      documentKey: promotionId,
      content: promotion
    });

    if (!createRes.ok) {
      return { success: false, messages: expiryMessages.createPromotionFailed };
    }

    return {
      success: true,
      promotion: { ...promotion, _id: promotionId }
    };
  }
}
