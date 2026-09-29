// $lib/server/db/pos-sessions.ts

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';

const cbPosSessions = cbData('pos_sessions');
const posSessionsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`pos_sessions\``;

const posAdminMessages = {
  notFound: {
    vi: 'Không tìm thấy phiên POS',
    en: 'POS session not found'
  } as TranslateContent,
  queryFailed: {
    vi: 'Truy vấn thất bại',
    en: 'Query failed'
  } as TranslateContent,
  openFailed: {
    vi: 'Không thể mở phiên POS',
    en: 'Failed to open POS session'
  } as TranslateContent,
  closeFailed: {
    vi: 'Không thể đóng phiên POS',
    en: 'Failed to close POS session'
  } as TranslateContent,
  sessionActive: {
    vi: 'Phiên POS đã mở',
    en: 'POS session already open'
  } as TranslateContent,
  sessionNotOpen: {
    vi: 'Phiên POS không ở trạng thái mở',
    en: 'POS session is not open'
  } as TranslateContent,
  permissionDenied: {
    vi: 'Bạn không có quyền thực hiện thao tác này',
    en: 'You do not have permission to perform this action'
  } as TranslateContent,
  cashNotMatched: {
    vi: 'Số tiền không khớp',
    en: 'Cash amount does not match'
  } as TranslateContent,
  invalidSession: {
    vi: 'Phiên POS không hợp lệ',
    en: 'Invalid POS session'
  } as TranslateContent
} as const;

const POS_SESSION_SAFE_FIELDS = [
  'branchId',
  'cashierId',
  'status',
  'openedAt',
  'closedAt',
  'openingCash',
  'closingCash',
  'expectedCash',
  'variance',
  'transactionCount',
  'totalSales'
] as const;

function sanitizePosSessionForAdmin(doc: any & { _id: string }) {
  const safe = { _id: doc._id } as Record<string, unknown>;
  for (const field of POS_SESSION_SAFE_FIELDS) {
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

export class PosSessionService {
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

  /**
   * Open a new POS session.
   */
  static async openSession(
    actor: ActorContext,
    data: {
      branchId: string;
      openingCash: number;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { session: Record<string, unknown> })> {
    const permError = await this.requirePermission(actor, 'pos:manage');
    if (permError) return permError;

    // Check if cashier already has active session
    const checkRes = await cbPosSessions.document.query({
      statement: `SELECT RAW COUNT(*) FROM ${posSessionsKeyspace} WHERE cashierId = $1 AND status = 'open'`,
      args: [actor.userId],
      readonly: true
    });

    if (checkRes.ok && Number(checkRes.data?.results?.[0] ?? 0) > 0) {
      return { success: false, messages: posAdminMessages.sessionActive };
    }

    const sessionId = `pos_${actor.userId}_${Date.now()}`;
    const now = new Date().toISOString();

    const session = {
      branchId: data.branchId,
      cashierId: actor.userId,
      status: 'open',
      openedAt: now,
      closedAt: null,
      openingCash: data.openingCash,
      closingCash: null,
      expectedCash: data.openingCash,
      variance: null,
      transactionCount: 0,
      totalSales: 0
    };

    const createRes = await cbPosSessions.document.create({
      documentKey: sessionId,
      content: session
    });

    if (!createRes.ok) {
      return { success: false, messages: posAdminMessages.openFailed };
    }

    return { success: true, session: sanitizePosSessionForAdmin({...session, _id: sessionId}) };
  }

  /**
   * Close a POS session with cash reconciliation.
   */
  static async closeSession(
    actor: ActorContext,
    data: {
      sessionId: string;
      closingCash: number;
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { session: Record<string, unknown>; variance: number })> {
    const permError = await this.requirePermission(actor, 'pos:manage');
    if (permError) return permError;

    const getRes = await cbPosSessions.document.get({ documentKey: data.sessionId });

    if (!getRes.ok) {
      return { success: false, messages: posAdminMessages.notFound };
    }

    const session = (getRes as any).data;

    if (session.status !== 'open') {
      return { success: false, messages: posAdminMessages.sessionNotOpen };
    }

    if (session.cashierId !== actor.userId && actor.roleName !== 'owner') {
      return { success: false, messages: posAdminMessages.permissionDenied };
    }

    const variance = data.closingCash - session.expectedCash;
    const now = new Date().toISOString();

    const updateRes = await cbPosSessions.document.update({
      documentKey: data.sessionId,
      content: {
        ...session,
        status: 'closed',
        closedAt: now,
        closingCash: data.closingCash,
        variance
      }
    });

    if (!updateRes.ok) {
      return { success: false, messages: posAdminMessages.closeFailed };
    }

    const closedSession = {
      ...session,
      status: 'closed',
      closedAt: now,
      closingCash: data.closingCash,
      variance
    };

    return { success: true, session: sanitizePosSessionForAdmin({...closedSession, _id: data.sessionId}), variance };
  }

  /**
   * Record a transaction in a session.
   */
  static async recordTransaction(
    actor: ActorContext,
    data: {
      sessionId: string;
      amount: number;
      type: 'sale' | 'refund' | 'payment';
    }
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { updated: boolean })> {
    const getRes = await cbPosSessions.document.get({ documentKey: data.sessionId });

    if (!getRes.ok) {
      return { success: false, messages: posAdminMessages.notFound };
    }

    const session = (getRes as any).data;

    if (session.status !== 'open') {
      return { success: false, messages: posAdminMessages.sessionNotOpen };
    }

    let adjustment = 0;
    if (data.type === 'sale') {
      adjustment = data.amount;
    } else if (data.type === 'refund') {
      adjustment = -data.amount;
    }

    const newExpectedCash = session.expectedCash + adjustment;
    const newTotalSales = session.totalSales + (data.type === 'sale' ? data.amount : data.type === 'refund' ? -data.amount : 0);

    const updateRes = await cbPosSessions.document.update({
      documentKey: data.sessionId,
      content: {
        ...session,
        expectedCash: newExpectedCash,
        transactionCount: (session.transactionCount ?? 0) + 1,
        totalSales: newTotalSales
      }
    });

    if (!updateRes.ok) {
      return { success: false, messages: posAdminMessages.queryFailed };
    }

    return { success: true, updated: true };
  }

  /**
   * List POS sessions.
   */
  static async listSessions(
    actor: ActorContext,
    options: {
      branchId?: string;
      status?: string;
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

    if (options.branchId) {
      conditions.push('branchId = $' + (args.length + 1));
      args.push(options.branchId);
    }

    if (options.status) {
      conditions.push('status = $' + (args.length + 1));
      args.push(options.status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const selectClause = 'META().id AS _id, ' + POS_SESSION_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

    const [countRes, dataRes] = await Promise.all([
      cbPosSessions.document.query({
        statement: `SELECT RAW COUNT(*) FROM ${posSessionsKeyspace} ${whereClause}`,
        args,
        readonly: true
      }),
      cbPosSessions.document.query({
        statement: `SELECT ${selectClause} FROM ${posSessionsKeyspace} ${whereClause} LIMIT ${pageSize} OFFSET ${offset}`,
        args,
        readonly: true
      })
    ]);

    if (!countRes.ok || !dataRes.ok) {
      return { success: false, messages: posAdminMessages.queryFailed };
    }

    const total = Number(countRes.data?.results?.[0] ?? 0);
    const items = (dataRes.data?.results ?? []).map(sanitizePosSessionForAdmin);

    return { success: true, items, total, page, pageSize };
  }

  /**
   * Get a specific POS session.
   */
  static async getSession(
    actor: ActorContext,
    sessionId: string
  ): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { session: Record<string, unknown> })> {
    const scope = await PermissionChecker.getScope(actor.roleName, 'pos:read');
    if (!scope) return { success: false, messages: posAdminMessages.permissionDenied };

    const res = await cbPosSessions.document.get({ documentKey: sessionId });

    if (!res.ok) {
      return { success: false, messages: posAdminMessages.notFound };
    }

    const session = (res as any).data;
    return { success: true, session: sanitizePosSessionForAdmin({...session, _id: sessionId}) };
  }
}
