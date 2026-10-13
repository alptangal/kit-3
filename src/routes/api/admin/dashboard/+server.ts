// src/routes/api/admin/dashboard/+server.ts
// Tổng hợp dữ liệu tổng quan admin: stat cards (orders/payments/shipments/inventory)
// + đơn gần đây + phiên POS đang mở. KHÔNG tạo dữ liệu giả — chỉ đọc qua services có sẵn.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import {
	OrderAdminService,
	PaymentService,
	ShipmentService,
	POSService,
	InventoryService
} from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Phiên đăng nhập đã hết hạn',
						en: 'Session expired'
					}
				},
				401
			);
		}

		// Mỗi khối chạy độc lập — 1 service lỗi không cản các khối còn lại.
		const [ordersStats, pendingPayments, activeShipments, openPosSessions, recentOrders, lowStock] =
			await Promise.allSettled([
				OrderAdminService.getStats(actor),
				PaymentService.list(actor, { status: 'pending', page: 1, pageSize: 1 }),
				ShipmentService.list(actor, { status: 'in_transit', page: 1, pageSize: 1 }),
				POSService.listSessions(actor, { status: 'open', page: 1, pageSize: 10 }),
				OrderAdminService.list(actor, { page: 1, pageSize: 8 }),
				InventoryService.listStock(actor, { page: 1, pageSize: 8, includeZero: true })
			]);

		const fulfill = <T>(p: PromiseSettledResult<T>, fallback: T): T =>
			p.status === 'fulfilled' ? p.value : fallback;

		const stats = fulfill(ordersStats, null as never);
		const payments = fulfill(pendingPayments, null as never);
		const shipments = fulfill(activeShipments, null as never);
		const posSessions = fulfill(openPosSessions, null as never);
		const orders = fulfill(recentOrders, null as never);
		const stock = fulfill(lowStock, null as never);

		return respond({
			ok: true,
			message: { vi: 'Lấy tổng quan thành công', en: 'Dashboard fetched successfully' },
			data: {
				orderStats: stats?.success ? stats.data : null,
				pendingPaymentsCount: payments?.success ? payments.data.total : null,
				activeShipmentsCount: shipments?.success ? shipments.data.total : null,
				openPosSessions: posSessions?.success ? posSessions.items : null,
				recentOrders: orders?.success ? orders.items : null,
				recentOrdersTotal: orders?.success ? orders.total : null,
				lowStock: stock?.success ? stock.items : null
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/dashboard]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
