// src/routes/api/admin/variants/update/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { ProductAdminService } from '$lib/server/db/products';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			documentKey: string;
			sku?: string;
			barcode?: string | null;
			attributes?: Record<string, string>;
			displayName?: string;
			price?: number;
			costPrice?: number | null;
			weight?: number | null;
			trackLot?: boolean;
			trackExpiry?: boolean;
			lowStockThreshold?: number | null;
			imageUrl?: string | null;
			status?: string;
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

		const { documentKey, ...data } = read.data;
		const result = await ProductAdminService.updateVariant(actor, documentKey, data);

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({ ok: true, message: result.messages });
	} catch (e) {
		console.error('[POST /api/admin/variants/update]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};