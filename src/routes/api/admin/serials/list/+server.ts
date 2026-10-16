// src/routes/api/admin/serials/list/+server.ts
// Danh sách + tìm kiếm serial/IMEI (trang quản lý serial, POS picker dùng endpoint in-stock riêng).
// Filter: variantId / branchId / status / search (LIKE serial) + phân trang.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { SerialService } from '$lib/server/db/serials';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;
	try {
		const read = await readAdminRequest<{
			variantId?: string;
			branchId?: string;
			status?: string;
			search?: string;
			page?: number;
			pageSize?: number;
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

		const result = await SerialService.listSerials(actor, {
			variantId: (read.data.variantId ?? '').trim() || undefined,
			branchId: (read.data.branchId ?? '').trim() || undefined,
			status: (read.data.status ?? '').trim() || undefined,
			search: (read.data.search ?? '').trim() || undefined,
			page: Number(read.data.page) || 1,
			pageSize: Number(read.data.pageSize) || 20
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}
		return respond({
			ok: true,
			message: { vi: 'Tải danh sách serial thành công', en: 'Serial list loaded' },
			data: { items: result.items, total: result.total, page: result.page, pageSize: result.pageSize }
		});
	} catch (e) {
		console.error('[POST /api/admin/serials/list]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
