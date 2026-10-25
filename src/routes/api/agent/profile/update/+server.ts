// src/routes/api/agent/profile/update/+server.ts
// POST { firstname, midname, lastname, dob, gender, social } — cập nhật thông tin
// hồ sơ SELF-SERVICE (session only, không đụng email/phone/vault).
// - Name: field plain searchable — ghi trực tiếp qua Users instance + save().
// - dob/gender/social: field plain mới trong schema users (dữ liệu hồ sơ KHÔNG mật
//   như email/phone nên không cần vault; profileEncrypted giữ nguyên — không có mật
//   khẩu session để unlock DEK user).
// fetchSecure contract: body mã hoá server-key, response mã hoá session-key.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { Users } from '$lib/server/db/users';
import type { User } from '$lib/modules/schema';

export const POST: RequestHandler = async (event) => {
	try {
		const read = await readAdminRequest<Record<string, unknown>>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64, data } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(event.locals);
		if (!actor) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		const user = await Users.getById(actor.userId);
		if (!user) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		const str = (v: unknown, max: number) =>
			typeof v === 'string' ? v.trim().slice(0, max) : undefined;

		const firstname = str(data.firstname, 100);
		const midname = str(data.midname, 100) ?? null;
		const lastname = str(data.lastname, 100) ?? null;
		const dob = str(data.dob, 20) ?? '';
		const gender = str(data.gender, 20) ?? '';
		const social = str(data.social, 300) ?? '';

		if (firstname !== undefined && !firstname) {
			return respond(
				{
					ok: false,
					message: { vi: 'Tên không được để trống', en: 'First name is required' }
				},
				400
			);
		}

		// Gán field rồi save() (update path — documentKey đã có).
		const inst = user as unknown as {
			user: User;
			save: () => Promise<{ success: boolean }>;
		};
		if (firstname !== undefined) inst.user.firstname = firstname;
		inst.user.midname = midname;
		inst.user.lastname = lastname;
		(inst.user as Record<string, unknown>).dob = dob;
		(inst.user as Record<string, unknown>).gender = gender;
		(inst.user as Record<string, unknown>).social = social;

		const saved = await inst.save();
		if (!saved.success) {
			return respond(
				{ ok: false, message: { vi: 'Cập nhật thất bại', en: 'Update failed' } },
				500
			);
		}

		return respond({
			ok: true,
			data: {
				firstname: inst.user.firstname,
				midname: inst.user.midname,
				lastname: inst.user.lastname,
				dob,
				gender,
				social
			}
		});
	} catch (e) {
		console.error('[POST /api/agent/profile/update]', e);
		return json({ ok: false, message: 'Server error' }, { status: 500 });
	}
};
