// src/routes/api/admin/pos/search/+server.ts
// POS terminal product search: keyword (sku/displayName/barcode) — capped limit 20.
// V2: nhận branchId để trả kèm tồn kho từng variant (stock) trong item —
// thêm field không phá client cũ. Không có branchId → stock undefined.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { ProductAdminService } from '$lib/server/db/products';
import { cbData } from '$modules/couchbase/clients';

const inventoryStockKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.inventory_stock`;

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{ search?: string; limit?: number; branchId?: string }>(event);
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

		const search = (read.data.search ?? '').trim();
		const limit = Math.min(20, Math.max(1, Math.floor(Number(read.data.limit) || 20)));
		const branchId = (read.data.branchId ?? '').trim() || actor.branchId || '';

		const result = await ProductAdminService.listVariants(actor, {
			page: 1,
			pageSize: limit,
			search: search || undefined
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		// ── Batch lấy tồn kho tại branch cho các variant trong kết quả ──
		// (1 query IN thay vì N query từng variant — tránh fan-out N1QL bị drop).
		let stockByVariant: Record<string, number> | undefined;
		const items = result.items as Array<Record<string, unknown>>;
		if (branchId && items.length > 0) {
			const ids = items.map((i) => String(i._id));
			const res = await cbData('inventory_stock').document.query({
				statement: `SELECT variantId, quantityOnHand FROM ${inventoryStockKeyspace} WHERE branchId = $1 AND variantId IN $2`,
				args: [branchId, ids],
				readonly: true
			});
			if (res.ok && res.data?.results) {
				stockByVariant = {};
				for (const row of res.data.results as Array<{ variantId: string; quantityOnHand?: number }>) {
					stockByVariant[row.variantId] = Number(row.quantityOnHand ?? 0);
				}
			}
		}
		const itemsWithStock = items.map((item) => ({
			...item,
			stock: stockByVariant ? Number(stockByVariant[String(item._id)] ?? 0) : undefined
		})) as Array<Record<string, unknown> & { stock?: number; serialStock?: number }>;

		// ── Serial/IMEI: đếm serial 'in_stock' cho variant trackSerial (badge POS) ──
		// Variant thường → bỏ qua. Chỉ trackSerial mới cần biết còn bao nhiêu serial.
		const serialsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.serial_numbers`;
		const trackSerialIds = itemsWithStock
			.filter((item) => item.trackSerial === true)
			.map((item) => String(item._id));
		if (branchId && trackSerialIds.length > 0) {
			const serialRes = await cbData('serial_numbers').document.query({
				statement: `SELECT variantId, COUNT(1) AS cnt FROM ${serialsKeyspace} WHERE branchId = $1 AND variantId IN $2 AND status = 'in_stock' GROUP BY variantId`,
				args: [branchId, trackSerialIds],
				readonly: true
			});
			if (serialRes.ok && serialRes.data?.results) {
				const cntByVariant: Record<string, number> = {};
				for (const row of serialRes.data.results as Array<{ variantId: string; cnt?: number }>) {
					cntByVariant[row.variantId] = Number(row.cnt ?? 0);
				}
				for (const item of itemsWithStock) {
					if (item.trackSerial === true) {
						item.serialStock = cntByVariant[String(item._id)] ?? 0;
					}
				}
			}
		}

		return respond({
			ok: true,
			message: { vi: 'Tìm kiếm sản phẩm thành công', en: 'Product search completed' },
			data: { items: itemsWithStock, total: result.total }
		});
	} catch (e) {
		console.error('[POST /api/admin/pos/search]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
