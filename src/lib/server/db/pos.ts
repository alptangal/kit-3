// $lib/server/db/pos.ts

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';

const cbPOS = cbData('pos_sessions');
const posKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`pos_sessions\``;

const posAdminMessages = {
  notFound: {
    vi: 'Không tìm thấy phiên POS',
    en: 'POS session not found'
  } as TranslateContent,
  queryFailed: {
    vi: 'Truy vấn thất bại',
    en: 'Query failed'
  } as TranslateContent,
  createFailed: {
    vi: 'Tạo phiên POS thất bại',
    en: 'Failed to create POS session'
  } as TranslateContent,
  updateFailed: {
    vi: 'Cập nhật phiên POS thất bại',
    en: 'Failed to update POS session'
  } as TranslateContent,
  permissionDenied: {
    vi: 'Bạn không có quyền thực hiện thao tác này',
    en: 'You do not have permission to perform this action'
  } as TranslateContent,
  sessionAlreadyOpen: {
    vi: 'Phiên POS đã được mở trên thiết bị này',
    en: 'POS session already open on this device'
  } as TranslateContent,
  sessionNotOpen: {
    vi: 'Phiên POS không được mở',
    en: 'POS session is not open'
  } as TranslateContent,
  reconciliationFailed: {
    vi: 'Hệ thống không thể đối soát tiền mặt',
    en: 'Failed to reconcile cash'
  } as TranslateContent,
  varianceDetected: {
    vi: 'Phát hiện chênh lệch tiền mặt',
    en: 'Cash variance detected'
  } as TranslateContent
} as const;

const POS_SESSION_ADMIN_SAFE_FIELDS = [
  'deviceId',
  'branchId',
  'userId',
  'status',
  'openingBalance',
  'totalSales',
  'totalReturns',
  'totalExpenses',
  'totalCash',
  'closingBalance',
  'variance',
  'notes',
  'openedAt',
  'closedAt'
] as const;

function sanitizePOSSessionForAdmin(doc: any & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of POS_SESSION_ADMIN_SAFE_FIELDS) {
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

export class POSService {
  private static async requirePermission(
    actor: ActorContext,
    permissionKey: string
  ): Promise<{ success: false; messages: TranslateContent } | null> {
    const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
      branchId: actor.branchId,
      actorUserId: actor.userId
    });
    if (!allowed) return { success: false, messages: posAdminMessages.permissionDenied };
    return null;
  }

  // ========== POS SESSIONS ==========

  /**
   * Open a POS session.
   */
  static async openSession(
    actor: ActorContext,
    sessionData: {
      deviceId: string;
      openingBalance: number;
      notes?: string;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { session: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'pos:manage');
    if (permError) return permError;

    // Check if device already has open session
    const existingRes = await cbPOS.document.query({
      statement: `SELECT META().id AS _id FROM ${posKeyspace} WHERE deviceId = $1 AND status = $2 AND branchId = $3`,
      args: [sessionData.deviceId, 'open', actor.branchId],
      readonly: true
    });

    if (existingRes.ok && (existingRes.data?.results?.length ?? 0) > 0) {
      return { success: false, messages: posAdminMessages.sessionAlreadyOpen };
    }

    const sessionId = `pos_${sessionData.deviceId}_${Date.now()}`;
    const now = new Date().toISOString();

    const session = {
      deviceId: sessionData.deviceId,
      branchId: actor.branchId,
      userId: actor.userId,
      status: 'open',
      openingBalance: sessionData.openingBalance,
      totalSales: 0,
      totalReturns: 0,
      totalExpenses: 0,
      totalCash: sessionData.openingBalance,
      closingBalance: null,
      variance: null,
      notes: sessionData.notes ?? '',
      openedAt: now,
      closedAt: null
    };

    const createRes = await cbPOS.document.create({
      documentKey: sessionId,
      content: session
    });

    if (!createRes.ok) {
      return { success: false, messages: posAdminMessages.createFailed };
    }

    return { success: true, session: sanitizePOSSessionForAdmin({...session, _id: sessionId}) };
  }

  /**
   * Get current session for a device.
   */
  static async getCurrentSession(
    actor: ActorContext,
    deviceId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { session: Record<string, unknown> })> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'pos:read');
    if (!scope) return { success: false, messages: posAdminMessages.permissionDenied };

    const res = await cbPOS.document.query({
      statement: `SELECT META().id AS _id, ${POS_SESSION_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')} FROM ${posKeyspace} WHERE deviceId = $1 AND status = $2 AND branchId = $3 LIMIT 1`,
      args: [deviceId, 'open', actor.branchId],
      readonly: true
    });

    if (!res.ok || !res.data?.results || res.data.results.length === 0) {
      return { success: false, messages: posAdminMessages.sessionNotOpen };
    }

    const session = res.data.results[0];
    return { success: true, session: sanitizePOSSessionForAdmin(session) };
  }

  /**
   * Update session totals (after transaction).
   */
  static async updateSessionTotals(
    actor: ActorContext,
    sessionId: string,
    updates: {
      salesToAdd?: number;
      returnsToAdd?: number;
      expensesToAdd?: number;
    }
  ): Promise<{ success: false; messages: TranslateContent } | { success: true }> {
    const permError = await this.requirePermission(actor, 'pos:manage');
    if (permError) return permError;

    const getRes = await cbPOS.document.get({ documentKey: sessionId });
    if (!getRes.ok) {
      return { success: false, messages: posAdminMessages.notFound };
    }

    const session = (getRes as any).data;

    if (session.status !== 'open') {
      return { success: false, messages: posAdminMessages.sessionNotOpen };
    }

    const updatedTotalSales = (session.totalSales ?? 0) + (updates.salesToAdd ?? 0);
    const updatedTotalReturns = (session.totalReturns ?? 0) + (updates.returnsToAdd ?? 0);
    const updatedTotalExpenses = (session.totalExpenses ?? 0) + (updates.expensesToAdd ?? 0);
    const updatedTotalCash = session.openingBalance + updatedTotalSales - updatedTotalReturns - updatedTotalExpenses;

    const updateRes = await cbPOS.document.update({
      documentKey: sessionId,
      content: {
        ...session,
        totalSales: updatedTotalSales,
        totalReturns: updatedTotalReturns,
        totalExpenses: updatedTotalExpenses,
        totalCash: updatedTotalCash
      }
    });

    if (!updateRes.ok) {
      return { success: false, messages: posAdminMessages.updateFailed };
    }

    return { success: true };
  }

  /**
   * Close a POS session with cash reconciliation.
   */
  static async closeSession(
    actor: ActorContext,
    sessionId: string,
    closureData: {
      closingBalance: number;
      notes?: string;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { session: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'pos:manage');
    if (permError) return permError;

    const getRes = await cbPOS.document.get({ documentKey: sessionId });
    if (!getRes.ok) {
      return { success: false, messages: posAdminMessages.notFound };
    }

    const session = (getRes as any).data;

    if (session.status !== 'open') {
      return { success: false, messages: posAdminMessages.sessionNotOpen };
    }

    const expectedCash = session.totalCash;
    const actualCash = closureData.closingBalance;
    const variance = actualCash - expectedCash;

    const now = new Date().toISOString();

    const updatedSession = {
      ...session,
      status: 'closed',
      closingBalance: actualCash,
      variance,
      notes: (session.notes ?? '') + (closureData.notes ? `\n${closureData.notes}` : ''),
      closedAt: now
    };

    const updateRes = await cbPOS.document.update({
      documentKey: sessionId,
      content: updatedSession
    });

    if (!updateRes.ok) {
      return { success: false, messages: posAdminMessages.updateFailed };
    }

    return { success: true, session: sanitizePOSSessionForAdmin({...updatedSession, _id: sessionId}) };
  }

  /**
   * List POS sessions.
   */
  static async listSessions(
    actor: ActorContext,
    options: {
      status?: string;
      deviceId?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & ListResult)> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'pos:read');
    if (!scope) return { success: false, messages: posAdminMessages.permissionDenied };

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

    if (options.deviceId) {
      conditions.push('deviceId = $' + (args.length + 1));
      args.push(options.deviceId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const selectClause = 'META().id AS _id, ' + POS_SESSION_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

    const [countRes, dataRes] = await Promise.all([
      cbPOS.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${posKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbPOS.document.query({
        statement: `SELECT ${selectClause} FROM ${posKeyspace} ${whereClause} ORDER BY openedAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: posAdminMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizePOSSessionForAdmin);

    return { success: true, items, total, page, pageSize };
  }
}
