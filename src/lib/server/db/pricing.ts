// $lib/server/db/pricing.ts

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';

const cbPromotions = cbData('promotions');
const promotionsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`promotions\``;

const pricingAdminMessages = {
  notFound: {
    vi: 'Không tìm thấy khuyến mãi',
    en: 'Promotion not found'
  } as TranslateContent,
  queryFailed: {
    vi: 'Truy vấn thất bại',
    en: 'Query failed'
  } as TranslateContent,
  createFailed: {
    vi: 'Tạo khuyến mãi thất bại',
    en: 'Failed to create promotion'
  } as TranslateContent,
  updateFailed: {
    vi: 'Cập nhật khuyến mãi thất bại',
    en: 'Failed to update promotion'
  } as TranslateContent,
  permissionDenied: {
    vi: 'Bạn không có quyền thực hiện thao tác này',
    en: 'You do not have permission to perform this action'
  } as TranslateContent,
  invalidPromotion: {
    vi: 'Mã giảm giá không hợp lệ hoặc đã hết hạn',
    en: 'Invalid or expired promotion code'
  } as TranslateContent,
  promotionExpired: {
    vi: 'Mã giảm giá đã hết lượt sử dụng',
    en: 'Promotion usage limit exceeded'
  } as TranslateContent,
  minOrderNotMet: {
    vi: 'Giá trị đơn hàng không đủ điều kiện áp dụng khuyến mãi',
    en: 'Order value does not meet promotion minimum'
  } as TranslateContent,
} as const;

const PROMOTION_ADMIN_SAFE_FIELDS = [
  'code',
  'name',
  'type',
  'value',
  'minOrderValue',
  'maxDiscountAmount',
  'usageLimit',
  'usageCount',
  'status',
  'startAt',
  'endAt',
  'createdAt'
] as const;

const VALID_PROMOTION_TYPES = ['percentage', 'fixed_amount', 'buy_x_get_y'] as const;
type PromotionType = typeof VALID_PROMOTION_TYPES[number];

function sanitizePromotionForAdmin(doc: any & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of PROMOTION_ADMIN_SAFE_FIELDS) {
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

export class PricingService {
  private static async requirePermission(
    actor: ActorContext,
    permissionKey: string
  ): Promise<{ success: false; messages: TranslateContent } | null> {
    const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
      branchId: actor.branchId,
      actorUserId: actor.userId
    });
    if (!allowed) return { success: false, messages: pricingAdminMessages.permissionDenied };
    return null;
  }

  // ========== PROMOTIONS ==========

  /**
   * List promotions.
   */
  static async listPromotions(
    actor: ActorContext,
    options: {
      status?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & ListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'promotions:read');
    if (!scope) return { success: false, messages: pricingAdminMessages.permissionDenied };

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
    const selectClause = 'META().id AS _id, ' + PROMOTION_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

    const [countRes, dataRes] = await Promise.all([
      cbPromotions.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${promotionsKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbPromotions.document.query({
        statement: `SELECT ${selectClause} FROM ${promotionsKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: pricingAdminMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizePromotionForAdmin);

    return { success: true, items, total, page, pageSize };
  }

  /**
   * Get a promotion.
   */
  static async getPromotion(
    actor: ActorContext,
    promotionId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { promotion: Record<string, unknown> })> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'promotions:read');
    if (!scope) return { success: false, messages: pricingAdminMessages.permissionDenied };

    const res = await cbPromotions.document.get({ documentKey: promotionId });

    if (!res.ok) {
      return { success: false, messages: pricingAdminMessages.notFound };
    }

    const promotion = (res as any).data;
    return { success: true, promotion: sanitizePromotionForAdmin({...promotion, _id: promotionId}) };
  }

  /**
   * Create a promotion.
   */
  static async createPromotion(
    actor: ActorContext,
    promotionData: {
      code: string;
      name: string;
      type: PromotionType;
      value: number;
      minOrderValue?: number;
      maxDiscountAmount?: number;
      usageLimit?: number;
      startAt: string;
      endAt: string;
      status: string;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { promotion: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'promotions:manage');
    if (permError) return permError;

    if (!VALID_PROMOTION_TYPES.includes(promotionData.type as any)) {
      return { success: false, messages: pricingAdminMessages.invalidPromotion };
    }

    const promotionId = `promo_${promotionData.code}_${Date.now()}`;
    const now = new Date().toISOString();

    const promotion = {
      code: promotionData.code,
      name: promotionData.name,
      type: promotionData.type,
      value: promotionData.value,
      minOrderValue: promotionData.minOrderValue ?? 0,
      maxDiscountAmount: promotionData.maxDiscountAmount ?? null,
      usageLimit: promotionData.usageLimit ?? null,
      usageCount: 0,
      status: promotionData.status,
      startAt: promotionData.startAt,
      endAt: promotionData.endAt,
      createdAt: now
    };

    const createRes = await cbPromotions.document.create({
      documentKey: promotionId,
      content: promotion
    });

    if (!createRes.ok) {
      return { success: false, messages: pricingAdminMessages.createFailed };
    }

    return { success: true, promotion: sanitizePromotionForAdmin({...promotion, _id: promotionId}) };
  }

  /**
   * Validate and apply promotion to an order total.
   */
  static async applyPromotion(
    promotionCode: string,
    orderTotal: number
  ): Promise<{ success: false; messages: TranslateContent } | { success: true; discountAmount: number; finalTotal: number }> {
    // Find promotion by code
    const findRes = await cbPromotions.document.query({
      statement: `SELECT META().id AS _id, ${PROMOTION_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')} FROM ${promotionsKeyspace} WHERE code = $1 LIMIT 1`,
      args: [promotionCode],
      readonly: true
    });

    if (!findRes.ok || !findRes.data?.results || findRes.data.results.length === 0) {
      return { success: false, messages: pricingAdminMessages.invalidPromotion };
    }

    const promotion = findRes.data.results[0];
    const now = new Date().toISOString();

    // Check if promotion is active
    if (promotion.status !== 'active') {
      return { success: false, messages: pricingAdminMessages.invalidPromotion };
    }

    // Check dates
    if (now < promotion.startAt || now > promotion.endAt) {
      return { success: false, messages: pricingAdminMessages.invalidPromotion };
    }

    // Check usage limit
    if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
      return { success: false, messages: pricingAdminMessages.promotionExpired };
    }

    // Check minimum order value
    if ((promotion.minOrderValue ?? 0) > 0 && orderTotal < promotion.minOrderValue) {
      return { success: false, messages: pricingAdminMessages.minOrderNotMet };
    }

    // Calculate discount
    let discountAmount = 0;
    if (promotion.type === 'percentage') {
      discountAmount = (orderTotal * promotion.value) / 100;
      if (promotion.maxDiscountAmount && discountAmount > promotion.maxDiscountAmount) {
        discountAmount = promotion.maxDiscountAmount;
      }
    } else if (promotion.type === 'fixed_amount') {
      discountAmount = promotion.value;
    }

    const finalTotal = Math.max(0, orderTotal - discountAmount);

    // Increment usage count
    await cbPromotions.document.update({
      documentKey: promotion._id,
      content: {
        ...promotion,
        usageCount: (promotion.usageCount ?? 0) + 1
      }
    });

    return { success: true, discountAmount, finalTotal };
  }
}
