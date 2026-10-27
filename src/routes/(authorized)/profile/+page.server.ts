// src/routes/(authorized)/profile/+page.server.ts
// Load thông tin hồ sơ đầy đủ cho profile page — MetaUser trong locals chỉ có
// firstName (JWT) + avatarUrl; dob/gender/social/midname/lastname đọc thẳng doc.
// LỖI DB → trả null (page fallback MetaUser, không chặn trang).

import type { PageServerLoad } from './$types';
import { cbData } from '$modules/couchbase/clients';

const cbUsers = cbData('users');

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.userId) return { profile: null };
	try {
		const res = await cbUsers.document.get({ documentKey: locals.user.userId });
		if (!res.ok || !res.data) return { profile: null };
		const d = res.data as Record<string, unknown>;
		return {
			profile: {
				firstname: typeof d.firstname === 'string' ? d.firstname : '',
				midname: typeof d.midname === 'string' ? d.midname : '',
				lastname: typeof d.lastname === 'string' ? d.lastname : '',
				dob: typeof d.dob === 'string' ? d.dob : '',
				gender: typeof d.gender === 'string' ? d.gender : '',
				social: typeof d.social === 'string' ? d.social : '',
				// Batch 16: trạng thái 2FA ban đầu — client seed totpSetup để badge/
				// guard totpCode hiển thị đúng ngay khi mở page (không phải sau 1 action).
				totpEnabled: d.totpEnabled === true
			}
		};
	} catch {
		return { profile: null };
	}
};
