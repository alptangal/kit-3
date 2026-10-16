// src/routes/api/admin/upload/+server.ts
//
// POST — upload ảnh lên dịch vụ hosting ngoài (HF Space), trả URL công khai để
// client lưu vào field ảnh của doc (products.imageUrl, posts.coverImageUrl...).
//
// KHÔNG dùng readAdminRequest (fetchSecure mã hoá JSON) — multipart FormData binary
// phải đi fetch thường. Session cookie vẫn xác thực qua hooks + getActorContext.
//
// Env (đọc bằng $env/dynamic/private để đổi .env không cần restart):
// - IMAGE_HOST_URL   (mặc định space của user)
// - IMAGE_HOST_TOKEN (Bearer token — thiếu → 503 với message rõ ràng)

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getActorContext } from '$lib/server/admin/api';
import { resolveLang, localize } from '$lib/server/i18n';
import { applyRateLimit } from '$lib/server/rate-limit';

const DEFAULT_IMAGE_HOST_URL = 'https://megaphuongdo-b3hauc3-images.hf.space/api/images';

// 5MB — khớp giới hạn phía UI (ImageUpload component)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const POST: RequestHandler = async (event) => {
	const lang = resolveLang(event.request.headers.get('accept-language'));

	try {
		// Rate limit 60 req/min theo prefix '/api/admin' — gọi tay vì route không đi qua readAdminRequest
		const rateLimited = await applyRateLimit(
			event.request,
			event.getClientAddress,
			event.url.pathname
		);
		if (rateLimited) return rateLimited;

		const actor = await getActorContext(event.locals);
		if (!actor) {
			return json(
				{ ok: false, message: localize({ vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' }, lang) },
				{ status: 401 }
			);
		}

		const token = env.IMAGE_HOST_TOKEN;
		if (!token || !token.trim()) {
			return json(
				{
					ok: false,
					message: localize(
						{
							vi: 'Chưa cấu hình IMAGE_HOST_TOKEN trong .env — vui lòng điền token rồi thử lại',
							en: 'IMAGE_HOST_TOKEN is not configured in .env — please set the token and retry'
						},
						lang
					)
				},
				{ status: 503 }
			);
		}

		let form: FormData;
		try {
			form = await event.request.formData();
		} catch {
			return json(
				{ ok: false, message: localize({ vi: 'Dữ liệu gửi lên không hợp lệ (không phải multipart)', en: 'Invalid request (not multipart)' }, lang) },
				{ status: 400 }
			);
		}

		const file = form.get('file');
		if (!(file instanceof File)) {
			return json(
				{ ok: false, message: localize({ vi: 'Thiếu file ảnh trong request', en: 'Missing image file' }, lang) },
				{ status: 400 }
			);
		}

		if (!ALLOWED_TYPES.includes(file.type)) {
			return json(
				{
					ok: false,
					message: localize(
						{ vi: 'Chỉ chấp nhận ảnh JPEG/PNG/WebP/GIF', en: 'Only JPEG/PNG/WebP/GIF images are allowed' },
						lang
					)
				},
				{ status: 400 }
			);
		}

		if (file.size > MAX_FILE_SIZE) {
			return json(
				{
					ok: false,
					message: localize(
						{ vi: 'Ảnh vượt quá 5MB — vui lòng chọn ảnh nhỏ hơn', en: 'Image exceeds 5MB — please choose a smaller one' },
						lang
					)
				},
				{ status: 413 }
			);
		}

		// Forward multipart nguyên vẹn tới hosting ngoài (fields name/description + file)
		const forward = new FormData();
		forward.append('name', (form.get('name') as string) || file.name);
		forward.append('description', (form.get('description') as string) || 'Uploaded via admin panel');
		forward.append('file', file, file.name);

		const hostUrl = env.IMAGE_HOST_URL?.trim() || DEFAULT_IMAGE_HOST_URL;
		// KHÔNG log token — chỉ log URL đích
		let hostRes: Response;
		try {
			hostRes = await fetch(hostUrl, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: forward
			});
		} catch (e) {
			console.error('[POST /api/admin/upload] forward failed:', e instanceof Error ? e.message : String(e));
			return json(
				{ ok: false, message: localize({ vi: 'Không kết nối được dịch vụ lưu ảnh — thử lại sau', en: 'Cannot reach the image hosting service — try again later' }, lang) },
				{ status: 502 }
			);
		}

		if (!hostRes.ok) {
			console.error('[POST /api/admin/upload] host status:', hostRes.status);
			return json(
				{
					ok: false,
					message: localize(
						{ vi: `Dịch vụ lưu ảnh từ chối (HTTP ${hostRes.status})`, en: `Image host rejected the upload (HTTP ${hostRes.status})` },
						lang
					)
				},
				{ status: 502 }
			);
		}

		// Hosting ngoài có thể trả JSON {url} / {data:{url}} / {link} hoặc text thuần.
		// Space hiện tại (HF): {data: "<python-dict-string>"} — dict bị str() hóa (single
		// quotes) nên không parse JSON được → trích URL bằng regex trên chuỗi data.
		const rawText = await hostRes.text();
		let imageUrl: string | undefined;
		try {
			const parsed = JSON.parse(rawText) as Record<string, unknown>;
			// data là object JSON chuẩn (định dạng khác của host)
			if (parsed.data && typeof parsed.data === 'object') {
				const nested = parsed.data as Record<string, unknown>;
				const candidate =
					(nested.url as string) ?? (nested.link as string) ?? (nested.image as string) ?? (nested.path as string) ?? (nested.src as string);
				if (typeof candidate === 'string') imageUrl = candidate;
			} else {
				const candidate =
					(parsed.url as string) ??
					(parsed.link as string) ??
					(parsed.image as string) ??
					(parsed.path as string);
				if (typeof candidate === 'string') imageUrl = candidate;
			}
			// data là string (Python dict str()-ized hoặc HTML/text) → tìm URL ảnh đầu tiên
			// Ưu tiên khóa 'src'/'url' trong chuỗi, rơi về http(s) đầu tiên gặp
			if (!imageUrl && typeof parsed.data === 'string') {
				const m = parsed.data.match(/'(?:src|url|link|image)':\s*'([^']+)'/) ?? parsed.data.match(/"(?:src|url|link|image)":\s*"([^"]+)"/);
				imageUrl = m?.[1] ?? parsed.data.match(/https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif)/i)?.[0];
			}
		} catch {
			// không phải JSON — coi như trả URL trực tiếp (hoặc trích URL nếu có trong text)
			imageUrl = rawText.match(/https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif)/i)?.[0] ?? rawText.trim();
		}
		if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
			imageUrl = imageUrl.startsWith('/') ? `${hostUrl.split('/api/')[0]}${imageUrl}` : undefined;
		}
		if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
			console.error('[POST /api/admin/upload] unexpected host response:', rawText.slice(0, 200));
			return json(
				{ ok: false, message: localize({ vi: 'Dịch vụ lưu ảnh trả kết quả không đọc được', en: 'Image host returned an unreadable response' }, lang) },
				{ status: 502 }
			);
		}

		return json({ ok: true, data: { url: imageUrl } });
	} catch (e) {
		console.error('[POST /api/admin/upload]', e);
		return json(
			{ ok: false, message: localize({ vi: 'Lỗi máy chủ khi tải ảnh lên', en: 'Server error while uploading image' }, lang) },
			{ status: 500 }
		);
	}
};
