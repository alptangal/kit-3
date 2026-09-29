// $lib/server/db/orders.ts

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { InferCollection } from '$modules/schema';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { InventoryService } from './inventory';

const cbOrders = cbData('orders');
const ordersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`orders\``;

const orderAdminMessages = {
  notFound: {
    vi: 'Không tìm thấy đơn hàng',
    en: 'Order not found'
  } as TranslateContent,
  queryFailed: {
    vi: 'Truy vấn đơn hàng thất bại',
    en: 'Failed to query orders'
  } as TranslateContent,
  createFailed: {
    vi: 'Tạo đơn hàng thất bại',
    en: 'Failed to create order'
  } as TranslateContent,
  updateFailed: {
    vi: 'Cập nhật đơn hàng thất bại',
    en: 'Failed to update order'
  } as TranslateContent,
  insufficientStock: {
    vi: 'Tồn kho không đủ',
    en: 'Insufficient stock'
  } as TranslateContent,
  permissionDenied: {
    vi: 'Bạn không có quyền thực hiện thao tác này',
    en: 'You do not have permission to perform this action'
  } as TranslateContent,
  invalidStatus: {
    vi: 'Trạng thái đơn hàng không hợp lệ',
    en: 'Invalid order status'
  } as TranslateContent,
  invalidOrderItems: {
    vi: 'Danh sách mục đơn hàng không hợp lệ',
    en: 'Invalid order items'
  } as TranslateContent,
} as const;

const ORDER_ADMIN_SAFE_FIELDS = [
  'orderCode',
  'customerId',
  'staffId',
  'branchId',
  'status',
  'items',
  'totalAmount',
  'createdAt',
  'updatedAt'
] as const;

const VALID_ORDER_STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled', 'returned'] as const;

function sanitizeOrderForAdmin(doc: any & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of ORDER_ADMIN_SAFE_FIELDS) {
    safe[field] = doc[field];
  }
  return safe;
}

interface OrderListResult {
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

type OrderStatus = typeof VALID_ORDER_STATUSES[number];
type OrderItem = {
  variantId: string;
  lotId?: string | null;
  quantity: number;
  price: number;
};

export class OrderService {
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
    if (!allowed) return { success: false, messages: orderAdminMessages.permissionDenied };
    return null;
  }

  /**
   * List orders with optional filtering.
   */
  static async listOrders(
    actor: ActorContext,
    options: {
      branchId?: string;
      status?: string;
      customerId?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & OrderListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'orders:read');
    if (!scope) return { success: false, messages: orderAdminMessages.permissionDenied };

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (scope === 'own_branch') {
      if (!actor.branchId) {
        return { success: false, messages: orderAdminMessages.permissionDenied };
      }
      conditions.push('branchId = $' + (args.length + 1));
      args.push(actor.branchId);
    }

    if (options.branchId) {
      conditions.push('branchId = $' + (args.length + 1));
      args.push(options.branchId);
    }

    if (options.status) {
      conditions.push('status = $' + (args.length + 1));
      args.push(options.status);
    }

    if (options.customerId) {
      conditions.push('customerId = $' + (args.length + 1));
      args.push(options.customerId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const selectClause = 'META().id AS _id, ' + ORDER_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

    const [countRes, dataRes] = await Promise.all([
      cbOrders.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${ordersKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbOrders.document.query({
        statement: `SELECT ${selectClause} FROM ${ordersKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: orderAdminMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizeOrderForAdmin);

    return { success: true, items, total, page, pageSize };
  }

  /**
   * Get a specific order.
   */
  static async getOrder(
    actor: ActorContext,
    orderId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { order: Record<string, unknown> })> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'orders:read');
    if (!scope) return { success: false, messages: orderAdminMessages.permissionDenied };

    const res = await cbOrders.document.get({ documentKey: orderId });

    if (!res.ok) {
      return { success: false, messages: orderAdminMessages.notFound };
    }

    const order = (res as any).data;
    if (scope === 'own_branch' && actor.branchId && order.branchId !== actor.branchId) {
      return { success: false, messages: orderAdminMessages.permissionDenied };
    }

    return { success: true, order: sanitizeOrderForAdmin({...order, _id: orderId}) };
  }

  /**
   * Create a new order and reserve inventory.
   */
  static async createOrder(
    actor: ActorContext,
    orderData: {
      orderCode: string;
      customerId?: string;
      branchId: string;
      items: OrderItem[];
      totalAmount: number;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { order: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'orders:create', orderData.branchId);
    if (permError) return permError;

    // Validate items
    if (!orderData.items || orderData.items.length === 0) {
      return { success: false, messages: orderAdminMessages.invalidOrderItems };
    }

    // Check inventory for all items before creating order
    for (const item of orderData.items) {
      const stockResult = await InventoryService.getStock(actor, item.variantId, orderData.branchId);
      if (!stockResult.success) {
        return { success: false, messages: orderAdminMessages.insufficientStock };
      }
      const stock = stockResult.stock as any;
      if ((stock.quantityOnHand ?? 0) < item.quantity) {
        return { success: false, messages: orderAdminMessages.insufficientStock };
      }
    }

    // Create order document
    const orderId = `${orderData.branchId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const order = {
      orderCode: orderData.orderCode,
      customerId: orderData.customerId ?? null,
      staffId: actor.userId,
      branchId: orderData.branchId,
      status: 'pending' as OrderStatus,
      items: orderData.items,
      totalAmount: orderData.totalAmount,
      createdAt: now,
      updatedAt: now
    };

    const createRes = await cbOrders.document.create({
      documentKey: orderId,
      content: order
    });

    if (!createRes.ok) {
      return { success: false, messages: orderAdminMessages.createFailed };
    }

    // Reserve inventory for each item
    for (const item of orderData.items) {
      await InventoryService.adjustStock(
        actor,
        item.variantId,
        orderData.branchId,
        -item.quantity,
        'order',
        orderId,
        actor.userId,
        `Order ${orderData.orderCode}`
      );
    }

    return { success: true, order: sanitizeOrderForAdmin({...order, _id: orderId}) };
  }

  /**
   * Update order status.
   */
  static async updateOrderStatus(
    actor: ActorContext,
    orderId: string,
    newStatus: OrderStatus
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { order: Record<string, unknown> })> {
    // Check if status is valid
    if (!VALID_ORDER_STATUSES.includes(newStatus as any)) {
      return { success: false, messages: orderAdminMessages.invalidStatus };
    }

    const permError = await this.requirePermission(actor, 'orders:update');
    if (permError) return permError;

    // Get current order
    const getRes = await cbOrders.document.get({ documentKey: orderId });
    if (!getRes.ok) {
      return { success: false, messages: orderAdminMessages.notFound };
    }

    const order = (getRes as any).data;

    // Check permission for branch
    if (actor.branchId && order.branchId !== actor.branchId) {
      const scope = await PermissionChecker.getScope(actor.roleName, 'orders:update');
      if (scope === 'own_branch') {
        return { success: false, messages: orderAdminMessages.permissionDenied };
      }
    }

    // Update status
    const updateRes = await cbOrders.document.update({
      documentKey: orderId,
      content: {
        ...order,
        status: newStatus,
        updatedAt: new Date().toISOString()
      }
    });

    if (!updateRes.ok) {
      return { success: false, messages: orderAdminMessages.updateFailed };
    }

    const updatedOrder = (updateRes as any).data;
    return { success: true, order: sanitizeOrderForAdmin({...updatedOrder, _id: orderId}) };
  }

  /**
   * Cancel order and release inventory.
   */
  static async cancelOrder(
    actor: ActorContext,
    orderId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { order: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'orders:cancel');
    if (permError) return permError;

    // Get current order
    const getRes = await cbOrders.document.get({ documentKey: orderId });
    if (!getRes.ok) {
      return { success: false, messages: orderAdminMessages.notFound };
    }

    const order = (getRes as any).data;

    // Check permission for branch
    if (actor.branchId && order.branchId !== actor.branchId) {
      const scope = await PermissionChecker.getScope(actor.roleName, 'orders:cancel');
      if (scope === 'own_branch') {
        return { success: false, messages: orderAdminMessages.permissionDenied };
      }
    }

    // Can only cancel pending orders
    if (order.status !== 'pending') {
      return { success: false, messages: orderAdminMessages.updateFailed };
    }

    // Release inventory for each item
    for (const item of order.items ?? []) {
      await InventoryService.adjustStock(
        actor,
        item.variantId,
        order.branchId,
        item.quantity,
        'order_cancelled',
        orderId,
        actor.userId,
        `Order ${order.orderCode} cancelled`
      );
    }

    // Update order status
    const updateRes = await cbOrders.document.update({
      documentKey: orderId,
      content: {
        ...order,
        status: 'cancelled' as OrderStatus,
        updatedAt: new Date().toISOString()
      }
    });

    if (!updateRes.ok) {
      return { success: false, messages: orderAdminMessages.updateFailed };
    }

    const updatedOrder = (updateRes as any).data;
    return { success: true, order: sanitizeOrderForAdmin({...updatedOrder, _id: orderId}) };
  }

  /**
   * Get orders for a customer (storefront view).
   */
  static async getCustomerOrders(
    actor: ActorContext,
    customerId: string,
    options: {
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & OrderListResult)> {
    // Customer can only see their own orders
    if (actor.userId !== customerId) {
      return { success: false, messages: orderAdminMessages.permissionDenied };
    }

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const whereClause = `WHERE customerId = $1`;
    const selectClause = 'META().id AS _id, ' + ORDER_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

    const [countRes, dataRes] = await Promise.all([
      cbOrders.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${ordersKeyspace} ${whereClause}`,
        args: [customerId],
        readonly: true
      }),
      cbOrders.document.query({
        statement: `SELECT ${selectClause} FROM ${ordersKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
        args: [customerId],
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: orderAdminMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizeOrderForAdmin);

    return { success: true, items, total, page, pageSize };
  }
}
