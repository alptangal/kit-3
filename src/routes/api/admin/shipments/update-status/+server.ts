// src/routes/api/admin/shipments/update-status/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { ShipmentService } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ shipmentId: string; status: string; notes?: string }>(event);
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

		if (!read.data.shipmentId || !read.data.status) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu ID vận đơn hoặc trạng thái', en: 'Missing shipment ID or status' } },
				400
			);
		}

		const result = await ShipmentService.updateStatus(
			actor,
			read.data.shipmentId,
			read.data.status,
			read.data.notes
		);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: {
				vi: 'Cập nhật trạng thái vận đơn thành công',
				en: 'Shipment status updated successfully'
			},
			data: { shipment: result.data }
		});
	} catch (e) {
		console.error('[POST /api/admin/shipments/update-status]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
