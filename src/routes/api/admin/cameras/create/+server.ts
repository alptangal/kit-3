// src/routes/api/admin/cameras/create/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { CameraService } from '$lib/server/db/cameras';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			name?: string;
			branchId?: string;
			brand?: string;
			model?: string;
			host?: string;
			port?: number;
			channel?: number;
			username?: string;
			password?: string;
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

		if (!read.data.name || !read.data.branchId || !read.data.brand || !read.data.host) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Thiếu thông tin bắt buộc (tên, chi nhánh, hãng, host)',
						en: 'Missing required fields (name, branch, brand, host)'
					}
				},
				400
			);
		}

		const result = await CameraService.create(actor, {
			name: read.data.name,
			branchId: read.data.branchId,
			brand: read.data.brand,
			model: read.data.model,
			host: read.data.host,
			port: read.data.port,
			channel: read.data.channel,
			username: read.data.username,
			password: read.data.password
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Đã tạo camera', en: 'Camera created' },
			data: { camera: result.camera }
		});
	} catch (e) {
		console.error('[POST /api/admin/cameras/create]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
