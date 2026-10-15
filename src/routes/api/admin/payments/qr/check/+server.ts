// src/routes/api/admin/payments/qr/check/+server.ts
// Check + auto-confirm 1 payment QR qua tool đối soát ngoài (config-driven).
// Body: { paymentCode } hoặc { orderId }. Trả trạng thái sau check.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { QrPaymentService } from '$lib/server/db/qr-payments';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';

const cbPayments = cbData('payments');
const paymentsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`payments\``;

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			paymentCode?: string;
			orderId?: string;
		}>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		// payments:read cho check (read-only khi chưa confirm); confirm thực sự là
		// side-effect — yêu cầu payments:manage giống confirmBankTransfer.
		const canManage = await PermissionChecker.can(actor.roleName, 'payments:manage', {
			branchId: actor.branchId,
			actorUserId: actor.userId
		});
		const canRead = await PermissionChecker.can(actor.roleName, 'payments:read', {
			branchId: actor.branchId,
			actorUserId: actor.userId
		});
		if (!canManage && !canRead) {
			return respond(
				{
					ok: false,
					message: { vi: 'Bạn không có quyền thực hiện thao tác này', en: 'You do not have permission to perform this action' }
				},
				403
			);
		}

		let paymentCode = read.data.paymentCode?.trim();
		if (!paymentCode && read.data.orderId) {
			// Tìm payment pending mới nhất của order này.
			const lookup = await cbPayments.document.query({
				statement: `
					SELECT p.paymentCode
					FROM ${paymentsKeyspace} p
					WHERE p.orderId = $1
					ORDER BY p.createdAt DESC
					LIMIT 1
				`.trim(),
				args: [read.data.orderId],
				readonly: true
			});
			paymentCode = ((lookup.data?.results?.[0] ?? null) as { paymentCode?: string } | null)?.paymentCode;
		}
		if (!paymentCode) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu paymentCode hoặc orderId', en: 'Missing paymentCode or orderId' } },
				400
			);
		}

		const result = await QrPaymentService.checkAndConfirm(paymentCode, { actorId: actor.userId });

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: result.messages,
			data: {
				paymentCode,
				status: result.status,
				payment: result.payment ?? null
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/payments/qr/check]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
