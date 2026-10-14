// src/routes/api/admin/cameras/update/+server.ts
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
			cameraId?: string;
			name?: string;
			brand?: string;
			model?: string | null;
			host?: string;
			port?: number;
			channel?: number;
			username?: string | null;
			password?: string;
			clearPassword?: boolean;
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

		if (!read.data.cameraId) {
			return respond(
				{ ok: false, message: { vi: 'Thiếu cameraId', en: 'cameraId is required' } },
				400
			);
		}

		const result = await CameraService.update(actor, read.data.cameraId, {
			name: read.data.name,
			brand: read.data.brand,
			model: read.data.model,
			host: read.data.host,
			port: read.data.port,
			channel: read.data.channel,
			username: read.data.username,
			password: read.data.password,
			clearPassword: read.data.clearPassword
		});

		if (!result.success) {
			return respond({ ok: false, message: result.messages }, statusForServiceFailure(result.messages));
		}

		return respond({
			ok: true,
			message: { vi: 'Đã cập nhật camera', en: 'Camera updated' },
			data: { camera: result.camera }
		});
	} catch (e) {
		console.error('[POST /api/admin/cameras/update]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
