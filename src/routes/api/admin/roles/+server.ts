// src/routes/api/admin/roles/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { readAdminRequest, respondEncrypted, getActorContext } from '$lib/server/admin/api';
import { UserAdminService } from '$lib/server/db/users';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import type { TranslateContent } from '$interfaces/basic';

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<Record<string, never>>(event);
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

		// Catalog chỉ dành cho người có quyền quản trị user — dùng PermissionChecker
		// trực tiếp (không qua UserAdminService vì không thao tác lên user cụ thể)
		const allowed = await PermissionChecker.can(actor.roleName, 'users:manage', {
			branchId: actor.branchId
		});
		if (!allowed) {
			return respond(
				{
					ok: false,
					message: {
						vi: 'Bạn không có quyền thực hiện thao tác này',
						en: 'You do not have permission to perform this action'
					}
				},
				403
			);
		}

		const [roles, statuses, grants] = await Promise.all([
			UserAdminService.listRoles(),
			UserAdminService.listStatuses(),
			UserAdminService.listGrants()
		]);

		const failure = [roles, statuses, grants].find((r) => !r.success) as
			| { success: false; messages: TranslateContent }
			| undefined;
		if (failure) {
			return respond({ ok: false, message: failure.messages }, 500);
		}

		return respond({
			ok: true,
			message: { vi: 'Lấy danh mục vai trò thành công', en: 'Role catalog fetched successfully' },
			data: {
				roles: (roles as { roles: unknown[] }).roles,
				statuses: (statuses as { statuses: unknown[] }).statuses,
				grants: (grants as { grants: unknown[] }).grants
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/roles]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
