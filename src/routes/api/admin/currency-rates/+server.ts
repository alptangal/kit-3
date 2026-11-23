// src/routes/api/admin/currency-rates/+server.ts
// B52 (m25115): tỷ giá quy đổi cho PO form — fetch live nguồn mở open.er-api.com
// (không key, free). Trả rates VND theo base USD. KHÔNG lưu DB — client cache session 30 phút.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';

const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const TIMEOUT_MS = 8000;

type ErApiResult = { result?: string; rates?: Record<string, number> };

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<Record<string, unknown>>(event);
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

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		try {
			const res = await fetch(RATES_URL, { signal: controller.signal });
			if (!res.ok) throw new Error(`upstream ${res.status}`);
			const data = (await res.json()) as ErApiResult;
			const vnd = Number(data.rates?.VND);
			if (!Number.isFinite(vnd) || vnd <= 0) throw new Error('rate VND missing');
			return respond({
				ok: true,
				message: { vi: 'Lấy tỷ giá thành công', en: 'Exchange rate fetched successfully' },
				data: { base: 'USD', rates: { VND: vnd }, fetchedAt: new Date().toISOString() }
			});
		} finally {
			clearTimeout(timer);
		}
	} catch (e) {
		console.error('[POST /api/admin/currency-rates]', e);
		return json(
			{ ok: false, message: { vi: 'Không lấy được tỷ giá', en: 'Failed to fetch exchange rate' } },
			{ status: 502 }
		);
	}
};
