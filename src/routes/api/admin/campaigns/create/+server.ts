// src/routes/api/admin/campaigns/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { CampaignService } from '$lib/server/db';
import type { CampaignType, CampaignSegmentRule } from '$lib/server/db/campaigns';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			name: string;
			type: CampaignType;
			description?: string;
			budget?: number;
			targetCount?: number;
			segmentRules?: CampaignSegmentRule[];
			promotionIds?: string[];
			startAt?: string;
			endAt?: string;
		}>(event);
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

		if (!read.data.name || !read.data.type) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu thông tin bắt buộc',
						en: 'Missing required fields'
					}
				},
				400
			);
		}

		const result = await CampaignService.createCampaign(actor, {
			name: read.data.name,
			type: read.data.type,
			description: read.data.description,
			budget: read.data.budget,
			targetCount: read.data.targetCount,
			segmentRules: read.data.segmentRules,
			promotionIds: read.data.promotionIds,
			startAt: read.data.startAt,
			endAt: read.data.endAt
		});

		if (!result.success) {
			return respond(
				{ ok: false, message: result.messages },
				statusForServiceFailure(result.messages)
			);
		}

		return respond({
			ok: true,
			message: { vi: 'Tạo chiến dịch thành công', en: 'Campaign created successfully' },
			data: result.data
		});
	} catch (e) {
		console.error('[POST /api/admin/campaigns/create]', e);
		return json(
			{ message: e instanceof Error ? e.message : String(e), ok: false },
			{ status: 500 }
		);
	}
};
